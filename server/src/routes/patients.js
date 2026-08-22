import { Router } from 'express'
import { z } from 'zod'
import { q, db } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const patientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  gender: z.enum(['Male', 'Female', 'Other']).default('Male'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  blood_group: z.string().trim().max(5).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable()
})

router.get('/', async (req, res) => {
  const s = `%${req.query.q || ''}%`
  res.json(await q.all(
    'SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? OR blood_group LIKE ? ORDER BY id DESC', s, s, s
  ))
})

router.get('/:id/detail', async (req, res) => {
  const patient = await q.get('SELECT * FROM patients WHERE id = ?', req.params.id)
  if (!patient) return res.status(404).json({ error: 'Patient not found' })
  const records = await q.all(`
    SELECT r.*, d.name AS doctor_name FROM medical_records r
    LEFT JOIN doctors d ON d.id = r.doctor_id
    WHERE r.patient_id = ? ORDER BY r.visit_date DESC, r.id DESC
  `, patient.id)
  const prescriptions = await q.all(`
    SELECT rx.*, d.name AS doctor_name FROM prescriptions rx
    LEFT JOIN doctors d ON d.id = rx.doctor_id
    WHERE rx.patient_id = ? ORDER BY rx.id DESC
  `, patient.id)
  const invoices = await q.all('SELECT * FROM invoices WHERE patient_id = ? ORDER BY id DESC', patient.id)
  const appointments = await q.all(`
    SELECT a.*, d.name AS doctor_name, d.specialization FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    WHERE a.patient_id = ? ORDER BY a.date DESC, a.time DESC
  `, patient.id)
  res.json({ patient, records, prescriptions, invoices, appointments })
})

router.post('/', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const parsed = patientSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Name is required (max 80 characters)' })
  const p = parsed.data
  const info = await q.run(
    'INSERT INTO patients (name, gender, dob, blood_group, phone, address) VALUES (?,?,?,?,?,?)',
    p.name, p.gender, p.dob || null, p.blood_group || null, p.phone || null, p.address || null
  )
  logAudit('PATIENT_CREATED', { req, entity: 'patient', entityId: info.lastInsertRowid, details: { name: p.name } })
  res.status(201).json(await q.get('SELECT * FROM patients WHERE id = ?', info.lastInsertRowid))
})

router.put('/:id', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const existing = await q.get('SELECT * FROM patients WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Patient not found' })
  const parsed = patientSchema.safeParse({ ...existing, ...req.body })
  if (!parsed.success) return res.status(400).json({ error: 'Invalid patient data' })
  const p = parsed.data
  await q.run(
    'UPDATE patients SET name=?, gender=?, dob=?, blood_group=?, phone=?, address=? WHERE id=?',
    p.name, p.gender, p.dob || null, p.blood_group || null, p.phone || null, p.address || null, req.params.id
  )
  logAudit('PATIENT_UPDATED', { req, entity: 'patient', entityId: Number(existing.id) })
  res.json(await q.get('SELECT * FROM patients WHERE id = ?', req.params.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const existing = await q.get('SELECT * FROM patients WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Patient not found' })

  const tx = await db.transaction('write')
  try {
    await tx.execute({
      sql: `DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id = ?)`,
      args: [existing.id]
    })
    for (const sql of [
      'DELETE FROM prescriptions WHERE patient_id = ?',
      'DELETE FROM medical_records WHERE patient_id = ?',
      'UPDATE invoices SET appointment_id = NULL WHERE patient_id = ?',
      'DELETE FROM invoices WHERE patient_id = ?',
      'DELETE FROM admissions WHERE patient_id = ?',
      'DELETE FROM appointments WHERE patient_id = ?'
    ]) {
      await tx.execute({ sql, args: [existing.id] })
    }
    await tx.execute({ sql: 'DELETE FROM patients WHERE id = ?', args: [existing.id] })
    await tx.commit()
  } catch (e) { await tx.rollback(); throw e }

  logAudit('PATIENT_DELETED', { req, entity: 'patient', entityId: Number(existing.id), details: { name: existing.name } })
  res.status(204).end()
})

export default router
