import { Router } from 'express'
import { z } from 'zod'
import { q, db } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const doctorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  specialization: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  fee: z.coerce.number().min(0).max(100000).default(0)
})

router.get('/', async (_req, res) => {
  res.json(await q.all('SELECT * FROM doctors ORDER BY name'))
})

router.post('/', requireRole('admin', 'receptionist'), async (req, res) => {
  const parsed = doctorSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Name, specialization and a valid email/fee are required' })
  const d = parsed.data
  const info = await q.run(
    'INSERT INTO doctors (name, specialization, phone, email, fee) VALUES (?,?,?,?,?)',
    d.name, d.specialization, d.phone || null, d.email || null, d.fee
  )
  logAudit('DOCTOR_CREATED', { req, entity: 'doctor', entityId: info.lastInsertRowid, details: { name: d.name } })
  res.status(201).json(await q.get('SELECT * FROM doctors WHERE id = ?', info.lastInsertRowid))
})

router.put('/:id', requireRole('admin', 'receptionist'), async (req, res) => {
  const existing = await q.get('SELECT * FROM doctors WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Doctor not found' })
  const parsed = doctorSchema.safeParse({ ...existing, ...req.body })
  if (!parsed.success) return res.status(400).json({ error: 'Invalid doctor data' })
  const d = parsed.data
  await q.run(
    'UPDATE doctors SET name=?, specialization=?, phone=?, email=?, fee=? WHERE id=?',
    d.name, d.specialization, d.phone || null, d.email || null, d.fee, req.params.id
  )
  logAudit('DOCTOR_UPDATED', { req, entity: 'doctor', entityId: Number(existing.id) })
  res.json(await q.get('SELECT * FROM doctors WHERE id = ?', req.params.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const existing = await q.get('SELECT * FROM doctors WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Doctor not found' })

  const tx = await db.transaction('write')
  try {
    await tx.execute({
      sql: 'DELETE FROM appointments WHERE doctor_id = ?',
      args: [existing.id]
    })
    await tx.execute({
      sql: 'UPDATE medical_records SET doctor_id = NULL WHERE doctor_id = ?',
      args: [existing.id]
    })
    await tx.execute({
      sql: 'UPDATE prescriptions SET doctor_id = NULL WHERE doctor_id = ?',
      args: [existing.id]
    })
    await tx.execute({ sql: 'DELETE FROM doctors WHERE id = ?', args: [existing.id] })
    await tx.commit()
  } catch (e) { await tx.rollback(); throw e }

  logAudit('DOCTOR_DELETED', { req, entity: 'doctor', entityId: Number(existing.id), details: { name: existing.name } })
  res.status(204).end()
})

export default router
