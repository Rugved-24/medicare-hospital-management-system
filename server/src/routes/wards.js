import { Router } from 'express'
import { z } from 'zod'
import { q, db } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/rooms', async (_req, res) => {
  res.json(await q.all(`
    SELECT r.*, a.id AS admission_id, p.name AS patient_name, a.admitted_date
    FROM rooms r
    LEFT JOIN admissions a ON a.room_id = r.id AND a.discharged_date IS NULL
    LEFT JOIN patients p ON p.id = a.patient_id
    ORDER BY r.ward, r.number
  `))
})

const roomSchema = z.object({
  ward: z.string().trim().min(1).max(40),
  number: z.string().trim().min(1).max(20),
  type: z.enum(['General', 'Private', 'ICU', 'Observation']).default('General'),
  daily_rate: z.coerce.number().min(0).max(100000).default(0)
})

router.post('/rooms', requireRole('admin'), async (req, res) => {
  const parsed = roomSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Ward and room number are required' })
  const { ward, number, type, daily_rate } = parsed.data
  if (await q.get('SELECT id FROM rooms WHERE number = ?', number)) {
    return res.status(409).json({ error: 'Room number already exists' })
  }
  const info = await q.run(
    'INSERT INTO rooms (ward, number, type, daily_rate) VALUES (?,?,?,?)',
    ward, number, type, daily_rate
  )
  logAudit('ROOM_CREATED', { req, entity: 'room', entityId: info.lastInsertRowid, details: { number } })
  res.status(201).json(await q.get('SELECT * FROM rooms WHERE id = ?', info.lastInsertRowid))
})

router.patch('/rooms/:id/status', requireRole('admin'), async (req, res) => {
  const room = await q.get('SELECT * FROM rooms WHERE id = ?', req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  const status = req.body?.status
  if (!['Available', 'Maintenance'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Available or Maintenance' })
  }
  if (room.status === 'Occupied') return res.status(400).json({ error: 'Room is occupied — discharge the patient first' })
  await q.run('UPDATE rooms SET status = ? WHERE id = ?', status, room.id)
  logAudit('ROOM_STATUS_CHANGED', { req, entity: 'room', entityId: Number(room.id), details: { from: room.status, to: status } })
  res.json(await q.get('SELECT * FROM rooms WHERE id = ?', room.id))
})

router.post('/admit', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const patient_id = req.body?.patient_id
  const room_id = req.body?.room_id
  if (!patient_id || !room_id) return res.status(400).json({ error: 'Patient and room are required' })
  const room = await q.get('SELECT * FROM rooms WHERE id = ?', room_id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (room.status !== 'Available') return res.status(409).json({ error: `Room ${room.number} is not available` })
  if (!(await q.get('SELECT id FROM patients WHERE id = ?', patient_id))) {
    return res.status(404).json({ error: 'Patient not found' })
  }

  const tx = await db.transaction('write')
  try {
    const info = await tx.execute({
      sql: 'INSERT INTO admissions (patient_id, room_id, notes) VALUES (?,?,?)',
      args: [patient_id, room_id, req.body?.notes ?? null]
    })
    await tx.execute({ sql: "UPDATE rooms SET status='Occupied' WHERE id=?", args: [room_id] })
    await tx.commit()
    logAudit('PATIENT_ADMITTED', { req, entity: 'admission', entityId: Number(info.lastInsertRowid), details: { patient_id, room: room.number } })
    res.status(201).json({ ok: true })
  } catch (e) { await tx.rollback(); throw e }
})

router.post('/discharge/:admissionId', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const adm = await q.get(`
    SELECT a.*, r.number AS room_number, r.daily_rate, p.name AS patient_name
    FROM admissions a
    JOIN rooms r ON r.id = a.room_id
    JOIN patients p ON p.id = a.patient_id
    WHERE a.id = ?
  `, req.params.admissionId)
  if (!adm) return res.status(404).json({ error: 'Admission not found' })
  if (adm.discharged_date) return res.status(400).json({ error: 'Patient already discharged' })

  const today = new Date().toISOString().slice(0, 10)
  const days = Math.max(1, Math.ceil((new Date(today) - new Date(adm.admitted_date)) / 86400000))
  const amount = days * Number(adm.daily_rate)

  const tx = await db.transaction('write')
  try {
    await tx.execute({ sql: 'UPDATE admissions SET discharged_date = ? WHERE id = ?', args: [today, adm.id] })
    await tx.execute({ sql: "UPDATE rooms SET status='Available' WHERE id = ?", args: [adm.room_id] })
    await tx.execute({
      sql: "INSERT INTO invoices (patient_id, amount, status, description) VALUES (?,?,'Pending',?)",
      args: [adm.patient_id, amount, `${adm.room_number} — ${days} day(s) @ $${Number(adm.daily_rate).toFixed(2)}/day`]
    })
    await tx.commit()
  } catch (e) { await tx.rollback(); throw e }

  logAudit('PATIENT_DISCHARGED', { req, entity: 'admission', entityId: Number(adm.id), details: { room: adm.room_number, days, invoice: amount } })
  res.json({ ok: true, billed_days: days, billed_amount: amount })
})

export default router
