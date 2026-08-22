import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Stethoscope, CalendarDays, TrendingUp, Clock3, AlertTriangle, BedDouble, Pill } from 'lucide-react'
import { api } from '../api.js'

function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (!Number.isFinite(Number(target))) return
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(Number(target) * eased))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return value
}

function StatCard({ icon: Icon, label, value, prefix = '', tone, delay }) {
  const animated = useCountUp(value)
  return (
    <div className={`stat-card tone-${tone}`} style={{ animationDelay: `${delay}ms` }}>
      <span className="stat-icon"><Icon size={20} strokeWidth={2.2} /></span>
      <div>
        <span className="stat-value">{prefix}{Number.isFinite(animated) ? animated : value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  )
}

export function StatusBadge({ status }) {
  const cls = { Completed: 'green', Cancelled: 'red', Paid: 'green', Pending: 'orange', Scheduled: 'blue' }[status] || 'gray'
  return <span className={`badge ${cls}`}>{status}</span>
}

function RevenueSpark({ data }) {
  if (!data?.length) return null
  const w = 560, h = 120, pad = 8
  const max = Math.max(...data.map((d) => Number(d.total)), 1)
  const step = (w - pad * 2) / Math.max(data.length - 1, 1)
  const pts = data.map((d, i) => [pad + i * step, h - pad - (Number(d.total) / max) * (h - pad * 2)])
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${path} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity=".25" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#revFill)" />
      <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/stats').then(setStats).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="alert error">{error}</div>
  if (!stats) {
    return (
      <div className="cards-grid">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton card-sk" />)}
      </div>
    )
  }

  const occupancyPct = stats.totalRooms ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0

  return (
    <div>
      <div className="cards-grid">
        <StatCard icon={Users} label="Total Patients" value={stats.totalPatients} tone="blue" delay={0} />
        <StatCard icon={Stethoscope} label="Doctors on Staff" value={stats.totalDoctors} tone="teal" delay={60} />
        <StatCard icon={CalendarDays} label="Today's Appointments" value={stats.todaysAppointments} tone="violet" delay={120} />
        <StatCard icon={TrendingUp} label="Revenue Collected" value={stats.revenue} prefix="$" tone="green" delay={180} />
      </div>

      <div className="dash-row">
        <div className="panel grow anim-rise" style={{ animationDelay: '220ms' }}>
          <div className="panel-head">
            <h3>Revenue — last 7 days</h3>
            <span className="chip orange">Pending: ${Number(stats.pendingAmount).toFixed(0)}</span>
          </div>
          <RevenueSpark data={stats.revenueByDay} />
        </div>

        <div className="panel side-panel anim-rise" style={{ animationDelay: '280ms' }}>
          <div className="panel-head"><h3><BedDouble size={16} /> Ward occupancy</h3></div>
          <div className="ring-wrap">
            <svg viewBox="0 0 84 84" className="ring">
              <circle cx="42" cy="42" r="34" fill="none" stroke="#e8edf5" strokeWidth="9" />
              <circle cx="42" cy="42" r="34" fill="none" stroke="#2563eb" strokeWidth="9"
                strokeLinecap="round" strokeDasharray={`${occupancyPct * 2.136} 999`}
                transform="rotate(-90 42 42)" style={{ transition: 'stroke-dasharray .6s ease-out' }} />
            </svg>
            <div className="ring-label"><strong>{occupancyPct}%</strong><span>{stats.occupiedRooms}/{stats.totalRooms} rooms</span></div>
          </div>
          <Link to="/wards" className="mini-link">Manage wards →</Link>
        </div>
      </div>

      <div className="dash-row">
        <div className="panel grow anim-rise" style={{ animationDelay: '320ms' }}>
          <div className="panel-head">
            <h3><Clock3 size={16} /> Recent appointments</h3>
            <Link to="/appointments" className="mini-link">View all →</Link>
          </div>
          {stats.recentAppointments.length === 0 ? (
            <p className="muted center-pad">No appointments yet.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr>
              </thead>
              <tbody>
                {stats.recentAppointments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.patient_name}</strong></td>
                    <td>{a.doctor_name} <span className="muted">· {a.specialization}</span></td>
                    <td>{a.date}</td>
                    <td>{a.time}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel side-panel anim-rise" style={{ animationDelay: '380ms' }}>
          <div className="panel-head"><h3><AlertTriangle size={16} /> Low stock</h3><Link to="/inventory" className="mini-link">Pharmacy →</Link></div>
          {stats.lowStockItems.length === 0 ? (
            <p className="muted center-pad">All stock levels healthy.</p>
          ) : stats.lowStockItems.map((m) => (
            <div key={m.id} className="stock-line">
              <span className={`badge ${m.quantity === 0 ? 'red' : 'orange'}`}>{m.quantity}</span>
              <span className="truncate">{m.name}</span>
            </div>
          ))}
          <div className="divider" />
          <div className="stock-line">
            <span className="badge blue"><Pill size={12} /></span>
            <span>{stats.pendingRx} prescription{stats.pendingRx === 1 ? '' : 's'} awaiting dispense</span>
          </div>
        </div>
      </div>
    </div>
  )
}
