import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { q } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const ROLES = ['admin', 'doctor', 'receptionist', 'pharmacist']

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  password: z.string().min(8).max(72)
})

const updateSchema = z.object({
  full_name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(72).optional()
})

router.get('/', async (_req, res) => {
  res.json(await q.all('SELECT id, full_name, email, role, active, created_at FROM users ORDER BY id'))
})

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Name, valid email, role and a password of at least 8 characters are required' })
  }
  const { full_name, email, role, password } = parsed.data
  if (await q.get('SELECT id FROM users WHERE email = ?', email)) {
    return res.status(409).json({ error: 'A user with this email already exists' })
  }
  const info = await q.run(
    'INSERT INTO users (email, password_hash, full_name, role) VALUES (?,?,?,?)',
    email, bcrypt.hashSync(password, 10), full_name, role
  )
  logAudit('USER_CREATED', { req, entity: 'user', entityId: info.lastInsertRowid, details: { email, role } })
  res.status(201).json(await q.get('SELECT id, full_name, email, role, active, created_at FROM users WHERE id = ?', info.lastInsertRowid))
})

router.put('/:id', async (req, res) => {
  const target = await q.get('SELECT * FROM users WHERE id = ?', req.params.id)
  if (!target) return res.status(404).json({ error: 'User not found' })
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid update payload' })
  const { full_name, role, active, password } = parsed.data

  if ((role && role !== target.role) || active === false) {
    if (target.role === 'admin') {
      const others = await q.get("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND id != ? AND active=1", target.id)
      if (!others.n) return res.status(400).json({ error: 'Cannot remove or disable the last active administrator' })
    }
  }

  await q.run(
    'UPDATE users SET full_name=?, role=?, active=? WHERE id=?',
    full_name ?? target.full_name,
    role ?? target.role,
    active === undefined ? target.active : (active ? 1 : 0),
    target.id
  )
  if (password) {
    await q.run('UPDATE users SET password_hash=? WHERE id=?', bcrypt.hashSync(password, 10), target.id)
  }
  logAudit('USER_UPDATED', { req, entity: 'user', entityId: Number(target.id), details: { full_name, role, active, passwordChanged: !!password } })
  res.json(await q.get('SELECT id, full_name, email, role, active, created_at FROM users WHERE id = ?', target.id))
})

router.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }
  const target = await q.get('SELECT * FROM users WHERE id = ?', req.params.id)
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.role === 'admin') {
    const others = await q.get("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND id != ?", target.id)
    if (!others.n) return res.status(400).json({ error: 'Cannot delete the last administrator' })
  }
  await q.run('DELETE FROM users WHERE id = ?', target.id)
  logAudit('USER_DELETED', { req, entity: 'user', entityId: Number(target.id), details: { email: target.email } })
  res.status(204).end()
})

export default router
