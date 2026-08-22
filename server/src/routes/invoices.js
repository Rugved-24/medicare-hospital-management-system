import { Router } from 'express'
import { z } from 'zod'
import { q } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const invoiceSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  appointment_id: z.coerce.number().int().positive().optional().nullable(),
  amount: z.coerce.number().positive().max(10000000),
  status: z.enum(['Pending', 'Paid']).default('Pending'),
  description: z.string().trim().max(300).optional().nullable()
})

router.get('/', async (req, res) => {
  const s = `%${req.query.q || ''}%`
  res.json(await q.all(`
    SELECT i.*, p.name AS patient_name
    FROM invoices i
    JOIN patients p ON p.id = i.patient_id
    WHERE p.name LIKE ? OR i.description LIKE ?
    ORDER BY i.id DESC
  `, s, s))
})

router.post('/', requireRole('admin', 'receptionist'), async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Patient and a positive amount are required' })
  const i = parsed.data
  const info = await q.run(
    'INSERT INTO invoices (patient_id, appointment_id, amount, status, description) VALUES (?,?,?,?,?)',
    i.patient_id, i.appointment_id ?? null, i.amount, i.status, i.description ?? null
  )
  logAudit('INVOICE_CREATED', { req, entity: 'invoice', entityId: info.lastInsertRowid, details: { patient_id: i.patient_id, amount: i.amount } })
  res.status(201).json(await q.get('SELECT * FROM invoices WHERE id = ?', info.lastInsertRowid))
})

router.patch('/:id/status', requireRole('admin', 'receptionist'), async (req, res) => {
  const existing = await q.get('SELECT * FROM invoices WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Invoice not found' })
  const parsed = z.object({ status: z.enum(['Pending', 'Paid']) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' })
  await q.run('UPDATE invoices SET status=? WHERE id=?', parsed.data.status, req.params.id)
  logAudit('INVOICE_STATUS_CHANGED', { req, entity: 'invoice', entityId: Number(existing.id), details: { from: existing.status, to: parsed.data.status } })
  res.json(await q.get('SELECT * FROM invoices WHERE id = ?', req.params.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const existing = await q.get('SELECT * FROM invoices WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Invoice not found' })
  await q.run('DELETE FROM invoices WHERE id = ?', req.params.id)
  logAudit('INVOICE_DELETED', { req, entity: 'invoice', entityId: Number(existing.id) })
  res.status(204).end()
})

export default router
