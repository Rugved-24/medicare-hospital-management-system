import { Router } from 'express'
import { z } from 'zod'
import { q, db } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const medicineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(60).optional().nullable(),
  quantity: z.coerce.number().int().min(0).max(1000000).default(0),
  price: z.coerce.number().min(0).max(1000000).default(0),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
})

router.get('/', async (req, res) => {
  const s = `%${req.query.q || ''}%`
  res.json(await q.all('SELECT * FROM medicines WHERE name LIKE ? OR category LIKE ? ORDER BY name', s, s))
})

router.post('/', requireRole('admin', 'pharmacist'), async (req, res) => {
  const parsed = medicineSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Name is required; quantity/price/expiry must be valid' })
  const m = parsed.data
  const info = await q.run(
    'INSERT INTO medicines (name, category, quantity, price, expiry_date) VALUES (?,?,?,?,?)',
    m.name, m.category || null, m.quantity, m.price, m.expiry_date || null
  )
  logAudit('MEDICINE_ADDED', { req, entity: 'medicine', entityId: info.lastInsertRowid, details: { name: m.name, quantity: m.quantity } })
  res.status(201).json(await q.get('SELECT * FROM medicines WHERE id = ?', info.lastInsertRowid))
})

router.put('/:id', requireRole('admin', 'pharmacist'), async (req, res) => {
  const existing = await q.get('SELECT * FROM medicines WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Medicine not found' })
  const parsed = medicineSchema.safeParse({ ...existing, ...req.body })
  if (!parsed.success) return res.status(400).json({ error: 'Invalid medicine data' })
  const m = parsed.data
  await q.run(
    'UPDATE medicines SET name=?, category=?, quantity=?, price=?, expiry_date=? WHERE id=?',
    m.name, m.category || null, m.quantity, m.price, m.expiry_date || null, req.params.id
  )
  logAudit('MEDICINE_UPDATED', { req, entity: 'medicine', entityId: Number(existing.id) })
  res.json(await q.get('SELECT * FROM medicines WHERE id = ?', req.params.id))
})

router.patch('/:id/stock', requireRole('admin', 'pharmacist'), async (req, res) => {
  const existing = await q.get('SELECT * FROM medicines WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Medicine not found' })
  const delta = parseInt(req.body?.delta, 10)
  if (!Number.isFinite(delta)) return res.status(400).json({ error: 'Invalid stock adjustment' })
  const newQty = Math.max(0, existing.quantity + delta)
  await q.run('UPDATE medicines SET quantity=? WHERE id=?', newQty, req.params.id)
  logAudit('STOCK_ADJUSTED', { req, entity: 'medicine', entityId: Number(existing.id), details: { name: existing.name, delta, newQty } })
  res.json(await q.get('SELECT * FROM medicines WHERE id = ?', req.params.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const existing = await q.get('SELECT * FROM medicines WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Medicine not found' })
  const tx = await db.transaction('write')
  try {
    await tx.execute({
      sql: `DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE status='Pending') AND medicine_id = ?`,
      args: [existing.id]
    })
    await tx.execute({ sql: 'DELETE FROM prescription_items WHERE medicine_id = ?', args: [existing.id] })
    await tx.execute({ sql: 'DELETE FROM medicines WHERE id = ?', args: [existing.id] })
    await tx.commit()
  } catch (e) { await tx.rollback(); throw e }
  logAudit('MEDICINE_DELETED', { req, entity: 'medicine', entityId: Number(existing.id), details: { name: existing.name } })
  res.status(204).end()
})

export default router
