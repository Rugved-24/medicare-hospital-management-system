import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db, q } from '../db.js'

let secret = process.env.JWT_SECRET
if (!secret) {
  console.warn('WARNING: JWT_SECRET not set — using an ephemeral secret. All sessions invalidate on restart. Set JWT_SECRET in production.')
  secret = crypto.randomBytes(48).toString('hex')
}

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, secret, { expiresIn: '12h' })
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  let payload
  try {
    payload = jwt.verify(token, secret)
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' })
  }
  const user = await q.get('SELECT id, email, full_name, role, active FROM users WHERE id = ?', payload.sub)
  if (!user || !user.active) return res.status(401).json({ error: 'Account is disabled' })
  req.user = user
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' })
    }
    next()
  }
}

export function logAudit(action, { req = null, userId = null, username = null, entity = null, entityId = null, details = null } = {}) {
  q.run(
    'INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?,?)',
    userId ?? req?.user?.id ?? null,
    username ?? req?.user?.email ?? null,
    action,
    entity,
    entityId,
    details == null ? null : typeof details === 'string' ? details : JSON.stringify(details),
    req?.ip ?? null
  ).catch((e) => console.error('audit write failed:', e.message))
}

export { db }
