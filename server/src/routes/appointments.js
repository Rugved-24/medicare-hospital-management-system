import { Router } from 'express'
import { z } from 'zod'
import { q, db } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const apptSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  doctor_id: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']).default('Scheduled'),
  notes: z.string().trim().max(500).optional().nullable()
})

router.get('/', async (req, res) => {
  const s = `%${req.query.q || ''}%`
  const status = req.query.status
  if (status && status !== 'All') {
    return res.json(await q.all(`
      SELECT a.*, p.name AS patient_name, d.name AS doctor_name, d.specialization, d.fee
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.status = ?
      ORDER BY a.date DESC, a.time DESC
    `, status))
  }
  res.json(await q.all(`
    SELECT a.*, p.name AS patient_name, d.name AS doctor_name, d.specialization, d.fee
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE p.name LIKE ? OR d.name LIKE ?
    ORDER BY a.date DESC, a.time DESC
  `, s, s))
})

router.post('/', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const parsed = apptSchema.safeParse({ ...req.body, status: 'Scheduled' })
  if (!parsed.success) return res.status(400).json({ error: 'Patient, doctor, valid date and time are required' })
  const a = parsed.data
  const info = await q.run(
    "INSERT INTO appointments (patient_id, doctor_id, date, time, status, notes) VALUES (?,?,?,?,?,?)",
    a.patient_id, a.doctor_id, a.date, a.time, 'Scheduled', a.notes ?? null
  )
  logAudit('APPOINTMENT_CREATED', { req, entity: 'appointment', entityId: info.lastInsertRowid, details: { patient_id: a.patient_id, date: a.date, time: a.time } })
  res.status(201).json(await q.get('SELECT * FROM appointments WHERE id = ?', info.lastInsertRowid))
})

router.put('/:id', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const existing = await q.get('SELECT * FROM appointments WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Appointment not found' })
  const parsed = apptSchema.safeParse({ ...existing, ...req.body })
  if (!parsed.success) return res.status(400).json({ error: 'Invalid appointment data' })
  const a = parsed.data
  await q.run(
    'UPDATE appointments SET patient_id=?, doctor_id=?, date=?, time=?, status=?, notes=? WHERE id=?',
    a.patient_id, a.doctor_id, a.date, a.time, a.status, a.notes ?? null, req.params.id
  )
  if (a.status !== existing.status) {
    logAudit('APPOINTMENT_STATUS_CHANGED', { req, entity: 'appointment', entityId: Number(existing.id), details: { from: existing.status, to: a.status } })
  }
  res.json(await q.get('SELECT * FROM appointments WHERE id = ?', req.params.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const existing = await q.get('SELECT * FROM appointments WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Appointment not found' })
  const tx = await db.transaction('write')
  try {
    await tx.execute({ sql: 'UPDATE invoices SET appointment_id = NULL WHERE appointment_id = ?', args: [existing.id] })
    await tx.execute({ sql: 'DELETE FROM appointments WHERE id = ?', args: [existing.id] })
    await tx.commit()
  } catch (e) { await tx.rollback(); throw e }
  logAudit('APPOINTMENT_DELETED', { req, entity: 'appointment', entityId: Number(existing.id) })
  res.status(204).end()
})

export default router
