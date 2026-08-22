import { Router } from 'express'
import { z } from 'zod'
import { q } from '../db.js'
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const recordSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  doctor_id: z.coerce.number().int().positive().optional().nullable(),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chief_complaint: z.string().trim().max(500).optional().nullable(),
  diagnosis: z.string().trim().max(500).optional().nullable(),
  treatment_plan: z.string().trim().max(1000).optional().nullable(),
  vitals_bp: z.string().trim().max(20).optional().nullable(),
  vitals_temp: z.coerce.number().min(25).max(45).optional().nullable(),
  vitals_pulse: z.coerce.number().int().min(20).max(250).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
})

router.get('/', async (req, res) => {
  const { patient_id } = req.query
  if (patient_id) {
    return res.json(await q.all(`
      SELECT r.*, d.name AS doctor_name, p.name AS patient_name
      FROM medical_records r
      LEFT JOIN doctors d ON d.id = r.doctor_id
      JOIN patients p ON p.id = r.patient_id
      WHERE r.patient_id = ?
      ORDER BY r.visit_date DESC, r.id DESC
    `, patient_id))
  }
  res.json(await q.all(`
    SELECT r.*, d.name AS doctor_name, p.name AS patient_name
    FROM medical_records r
    LEFT JOIN doctors d ON d.id = r.doctor_id
    JOIN patients p ON p.id = r.patient_id
    ORDER BY r.visit_date DESC, r.id DESC
    LIMIT 300
  `))
})

router.post('/', requireRole('admin', 'doctor'), async (req, res) => {
  const parsed = recordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Patient, visit date and valid fields are required' })
  const d = parsed.data
  if (!(await q.get('SELECT id FROM patients WHERE id=?', d.patient_id))) {
    return res.status(400).json({ error: 'Patient not found' })
  }
  const info = await q.run(`
    INSERT INTO medical_records (patient_id, doctor_id, visit_date, chief_complaint, diagnosis, treatment_plan, vitals_bp, vitals_temp, vitals_pulse, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `, d.patient_id, d.doctor_id ?? null, d.visit_date,
    d.chief_complaint ?? null, d.diagnosis ?? null, d.treatment_plan ?? null,
    d.vitals_bp ?? null, d.vitals_temp ?? null, d.vitals_pulse ?? null, d.notes ?? null)
  logAudit('RECORD_CREATED', { req, entity: 'medical_record', entityId: info.lastInsertRowid, details: { patient_id: d.patient_id } })
  res.status(201).json(await q.get('SELECT * FROM medical_records WHERE id = ?', info.lastInsertRowid))
})

router.put('/:id', requireRole('admin', 'doctor'), async (req, res) => {
  const existing = await q.get('SELECT * FROM medical_records WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Record not found' })
  let merged
  try {
    merged = recordSchema.parse({ ...existing, ...req.body })
  } catch {
    return res.status(400).json({ error: 'Invalid record data' })
  }
  await q.run(`
    UPDATE medical_records SET patient_id=?, doctor_id=?, visit_date=?, chief_complaint=?, diagnosis=?, treatment_plan=?, vitals_bp=?, vitals_temp=?, vitals_pulse=?, notes=?
    WHERE id=?
  `, merged.patient_id, merged.doctor_id ?? null, merged.visit_date,
    merged.chief_complaint ?? null, merged.diagnosis ?? null, merged.treatment_plan ?? null,
    merged.vitals_bp ?? null, merged.vitals_temp ?? null, merged.vitals_pulse ?? null, merged.notes ?? null,
    existing.id)
  logAudit('RECORD_UPDATED', { req, entity: 'medical_record', entityId: Number(existing.id) })
  res.json(await q.get('SELECT * FROM medical_records WHERE id = ?', existing.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const existing = await q.get('SELECT * FROM medical_records WHERE id = ?', req.params.id)
  if (!existing) return res.status(404).json({ error: 'Record not found' })
  await q.run('DELETE FROM medical_records WHERE id = ?', req.params.id)
  logAudit('RECORD_DELETED', { req, entity: 'medical_record', entityId: Number(existing.id) })
  res.status(204).end()
})

export default router
