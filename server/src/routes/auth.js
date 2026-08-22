import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { q } from '../db.js'
import { requireAuth, signToken, logAudit } from '../middleware/auth.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(72)
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Valid email and password are required' })
  const { email, password } = parsed.data

  const user = await q.get('SELECT * FROM users WHERE email = ?', email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logAudit('LOGIN_FAILED', { username: email, ip: req.ip, details: { reason: !user ? 'unknown-email' : 'bad-password' } })
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  if (!user.active) {
    logAudit('LOGIN_FAILED', { userId: user.id, username: email, ip: req.ip, details: { reason: 'disabled' } })
    return res.status(403).json({ error: 'This account has been disabled' })
  }

  const token = signToken(user)
  logAudit('LOGIN_SUCCESS', { userId: user.id, username: user.email, ip: req.ip })
  res.json({
    token,
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
  })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, full_name: req.user.full_name, email: req.user.email, role: req.user.role } })
})

export default router
