import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { ZodError } from 'zod'
import { q, ready } from './db.js'
import { requireAuth } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import patientRoutes from './routes/patients.js'
import doctorRoutes from './routes/doctors.js'
import appointmentRoutes from './routes/appointments.js'
import invoiceRoutes from './routes/invoices.js'
import inventoryRoutes from './routes/inventory.js'
import recordRoutes from './routes/records.js'
import prescriptionRoutes from './routes/prescriptions.js'
import wardRoutes from './routes/wards.js'
import auditRoutes from './routes/audit.js'
import reportRoutes from './routes/reports.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000'
app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '256kb' }))

app.use('/api', (_req, res, next) => {
  ready.then(() => next(), (e) => res.status(500).json({ error: 'Database unavailable' }))
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 2000,
  standardHeaders: 'draft-7',
  legacyHeaders: false
})
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth/login', loginLimiter)
app.use('/api', apiLimiter)

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/patients', patientRoutes)
app.use('/api/doctors', doctorRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/prescriptions', prescriptionRoutes)
app.use('/api/wards', wardRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/reports', reportRoutes)

app.get('/api/stats', requireAuth, async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const revenueByDay = await q.all(`
    WITH RECURSIVE days(d) AS (
      SELECT date('now','-6 days')
      UNION ALL SELECT date(d,'+1 day') FROM days WHERE d < date('now')
    )
    SELECT d AS date, COALESCE(SUM(CASE WHEN i.status='Paid' THEN i.amount END),0) AS total
    FROM days LEFT JOIN invoices i ON i.date = days.d
    GROUP BY d ORDER BY d
  `)
  res.json({
    totalPatients: (await q.get('SELECT COUNT(*) AS n FROM patients')).n,
    totalDoctors: (await q.get('SELECT COUNT(*) AS n FROM doctors')).n,
    todaysAppointments: (await q.get('SELECT COUNT(*) AS n FROM appointments WHERE date = ?', today)).n,
    scheduledAppointments: (await q.get("SELECT COUNT(*) AS n FROM appointments WHERE status='Scheduled'")).n,
    revenue: (await q.get("SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status='Paid'")).n,
    pendingAmount: (await q.get("SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status='Pending'")).n,
    lowStockItems: await q.all('SELECT id, name, quantity FROM medicines WHERE quantity <= 10 ORDER BY quantity LIMIT 6'),
    pendingRx: (await q.get("SELECT COUNT(*) AS n FROM prescriptions WHERE status='Pending'")).n,
    occupiedRooms: (await q.get("SELECT COUNT(*) AS n FROM rooms WHERE status='Occupied'")).n,
    totalRooms: (await q.get('SELECT COUNT(*) AS n FROM rooms')).n,
    revenueByDay,
    recentAppointments: await q.all(`
      SELECT a.id, a.date, a.time, a.status, p.name AS patient_name, d.name AS doctor_name, d.specialization
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      JOIN doctors d ON d.id = a.doctor_id
      ORDER BY a.date DESC, a.time DESC
      LIMIT 6
    `)
  })
})

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.use((err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.errors?.[0]?.message || 'Invalid request data' })
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Malformed request body' })
  }
  console.error(err)
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' })
})

if (!process.env.VERCEL) {
  ready.then(() => {
    const PORT = process.env.PORT || 4000
    app.listen(PORT, () => console.log(`Hospital API running at http://localhost:${PORT}`))
  })
}

export default app
