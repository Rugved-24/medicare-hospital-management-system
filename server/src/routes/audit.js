import { Router } from 'express'
import { q } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 150, 500)
  const action = req.query.action
  if (action && action !== 'All') {
    return res.json(await q.all(
      'SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT ?', action, limit
    ))
  }
  res.json(await q.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', limit))
})

router.get('/actions', async (_req, res) => {
  const rows = await q.all('SELECT DISTINCT action FROM audit_logs ORDER BY action')
  res.json(rows.map((r) => r.action))
})

export default router
