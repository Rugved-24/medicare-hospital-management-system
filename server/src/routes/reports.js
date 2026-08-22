import { Router } from 'express'
import { q } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (_req, res) => {
  const monthly = await q.all(`
    SELECT strftime('%Y-%m', date) AS month, SUM(amount) AS total
    FROM invoices WHERE status='Paid' AND date >= date('now','-11 months')
    GROUP BY month ORDER BY month
  `)
  const statusCounts = await q.all('SELECT status, COUNT(*) AS count FROM appointments GROUP BY status')
  const genderCounts = await q.all('SELECT gender, COUNT(*) AS count FROM patients GROUP BY gender')
  const topMedicines = await q.all(`
    SELECT m.name, SUM(pi.quantity) AS units
    FROM prescription_items pi
    JOIN medicines m ON m.id = pi.medicine_id
    GROUP BY m.id ORDER BY units DESC LIMIT 6
  `)
  const topDiagnoses = await q.all(`
    SELECT COALESCE(NULLIF(diagnosis,''),'Unspecified') AS diagnosis, COUNT(*) AS count
    FROM medical_records
    GROUP BY diagnosis ORDER BY count DESC LIMIT 6
  `)
  const occupancy = {
    total: (await q.get('SELECT COUNT(*) AS n FROM rooms')).n,
    occupied: (await q.get("SELECT COUNT(*) AS n FROM rooms WHERE status='Occupied'")).n,
    maintenance: (await q.get("SELECT COUNT(*) AS n FROM rooms WHERE status='Maintenance'")).n,
    available: (await q.get("SELECT COUNT(*) AS n FROM rooms WHERE status='Available'")).n
  }
  res.json({ monthly, statusCounts, genderCounts, topMedicines, topDiagnoses, occupancy })
})

export default router
