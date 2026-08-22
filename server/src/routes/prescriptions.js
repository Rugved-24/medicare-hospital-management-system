import { Router } from 'express'
import { z } from 'zod'
import { q, db } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

async function attachItems(rows) {
  if (!rows.length) return []
  const ids = rows.map((r) => Number(r.id))
  const placeholders = ids.map(() => '?').join(',')
  const items = await q.all(`
    SELECT pi.*, m.name AS medicine_name, m.price AS unit_price
    FROM prescription_items pi
    JOIN medicines m ON m.id = pi.medicine_id
    WHERE pi.prescription_id IN (${placeholders})
  `, ...ids)
  const byRx = {}
  for (const it of items) {
    ;(byRx[it.prescription_id] ||= []).push(it)
  }
  return rows.map((r) => ({ ...r, items: byRx[r.id] || [] }))
}

router.get('/', async (req, res) => {
  const { patient_id, status } = req.query
  let sql = `
    SELECT rx.*, p.name AS patient_name, d.name AS doctor_name
    FROM prescriptions rx
    JOIN patients p ON p.id = rx.patient_id
    LEFT JOIN doctors d ON d.id = rx.doctor_id
    WHERE 1=1`
  const params = []
  if (patient_id) { sql += ' AND rx.patient_id = ?'; params.push(patient_id) }
  if (status && status !== 'All') { sql += ' AND rx.status = ?'; params.push(status) }
  sql += ' ORDER BY rx.id DESC LIMIT 300'
  res.json(await attachItems(await q.all(sql, ...params)))
})

const itemSchema = z.object({
  medicine_id: z.coerce.number().int().positive(),
  dosage: z.string().trim().max(120).optional().nullable(),
  duration_days: z.coerce.number().int().min(1).max(365).default(1),
  quantity: z.coerce.number().int().min(1).max(10000)
})

const createSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  doctor_id: z.coerce.number().int().positive().optional().nullable(),
  record_id: z.coerce.number().int().positive().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  diagnosis: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(itemSchema).min(1, 'At least one medicine is required').max(20)
})

router.post('/', requireRole('admin', 'doctor'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Patient and at least one valid medicine item are required' })
  const d = parsed.data
  if (!(await q.get('SELECT id FROM patients WHERE id=?', d.patient_id))) {
    return res.status(400).json({ error: 'Patient not found' })
  }

  const tx = await db.transaction('write')
  try {
    const info = await tx.execute({
      sql: "INSERT INTO prescriptions (patient_id, doctor_id, record_id, date, diagnosis, notes, status) VALUES (?,?,?,?,?,?,'Pending')",
      args: [d.patient_id, d.doctor_id ?? null, d.record_id ?? null,
        d.date || new Date().toISOString().slice(0, 10), d.diagnosis ?? null, d.notes ?? null]
    })
    const rxId = Number(info.lastInsertRowid)
    for (const it of d.items) {
      await tx.execute({
        sql: 'INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration_days, quantity) VALUES (?,?,?,?,?)',
        args: [rxId, it.medicine_id, it.dosage ?? null, it.duration_days, it.quantity]
      })
    }
    await tx.commit()
    logAudit('RX_CREATED', { req, entity: 'prescription', entityId: rxId, details: { patient_id: d.patient_id, items: d.items.length } })
    const row = await q.get(`
      SELECT rx.*, p.name AS patient_name, d.name AS doctor_name
      FROM prescriptions rx
      JOIN patients p ON p.id = rx.patient_id
      LEFT JOIN doctors d ON d.id = rx.doctor_id
      WHERE rx.id = ?
    `, rxId)
    res.status(201).json((await attachItems([row]))[0])
  } catch (e) {
    await tx.rollback(); throw e
  }
})

router.patch('/:id/dispense', requireRole('admin', 'pharmacist', 'doctor'), async (req, res) => {
  const rx = await q.get('SELECT * FROM prescriptions WHERE id = ?', req.params.id)
  if (!rx) return res.status(404).json({ error: 'Prescription not found' })
  if (rx.status === 'Dispensed') return res.status(400).json({ error: 'Prescription has already been dispensed' })

  const items = await q.all(`
    SELECT pi.*, m.name AS medicine_name, m.quantity AS stock
    FROM prescription_items pi JOIN medicines m ON m.id = pi.medicine_id
    WHERE pi.prescription_id = ?
  `, rx.id)

  const shortages = items.filter((it) => it.stock < it.quantity)
  if (shortages.length > 0) {
    return res.status(409).json({
      error: 'Insufficient stock',
      shortages: shortages.map((s) => ({ medicine: s.medicine_name, required: s.quantity, available: s.stock }))
    })
  }

  const tx = await db.transaction('write')
  try {
    for (const it of items) {
      await tx.execute({ sql: 'UPDATE medicines SET quantity = quantity - ? WHERE id = ?', args: [it.quantity, it.medicine_id] })
      await tx.execute({ sql: 'UPDATE prescription_items SET dispensed = 1 WHERE id = ?', args: [it.id] })
    }
    await tx.execute({ sql: "UPDATE prescriptions SET status='Dispensed' WHERE id=?", args: [rx.id] })
    await tx.commit()
  } catch (e) { await tx.rollback(); throw e }

  logAudit('RX_DISPENSED', { req, entity: 'prescription', entityId: Number(rx.id), details: { items: items.length } })
  const row = await q.get(`
    SELECT rx.*, p.name AS patient_name, d.name AS doctor_name
    FROM prescriptions rx
    JOIN patients p ON p.id = rx.patient_id
    LEFT JOIN doctors d ON d.id = rx.doctor_id
    WHERE rx.id = ?
  `, rx.id)
  res.json((await attachItems([row]))[0])
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const rx = await q.get('SELECT * FROM prescriptions WHERE id = ?', req.params.id)
  if (!rx) return res.status(404).json({ error: 'Prescription not found' })
  if (rx.status === 'Dispensed') return res.status(400).json({ error: 'Cannot delete a dispensed prescription' })
  await q.run('DELETE FROM prescription_items WHERE prescription_id = ?', rx.id)
  await q.run('DELETE FROM prescriptions WHERE id = ?', rx.id)
  logAudit('RX_DELETED', { req, entity: 'prescription', entityId: Number(rx.id) })
  res.status(204).end()
})

export default router
