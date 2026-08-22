import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Pill, Stethoscope, BedDouble, Users } from 'lucide-react'
import { api } from '../api.js'

function Bars({ data, color = '#2563eb', suffix = '' }) {
  if (!data?.length) return <p className="muted center-pad">No data yet.</p>
  const max = Math.max(...data.map((d) => Number(d.value)), 1)
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div key={d.label} className="bar-row anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="bar-label truncate">{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(Number(d.value) / max) * 100}%`, background: color }} />
          </div>
          <span className="bar-value">{Number(d.value).toLocaleString()}{suffix}</span>
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/reports').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="alert error">{error}</div>
  if (!data) return <div className="panel"><div className="skeleton table-sk" /></div>

  const monthly = data.monthly.map((m) => ({ label: m.month, value: Number(m.total) }))
  const medicines = data.topMedicines.map((m) => ({ label: m.name, value: Number(m.units) }))
  const diagnoses = data.topDiagnoses.filter((d) => d.diagnosis).map((d) => ({ label: d.diagnosis, value: Number(d.count) }))
  const occ = data.occupancy

  return (
    <div>
      <div className="cards-grid three">
        <div className="stat-card tone-green anim-rise">
          <span className="stat-icon"><TrendingUp size={20} /></span>
          <div><span className="stat-value">${monthly.reduce((s, m) => s + m.value, 0).toLocaleString()}</span><span className="stat-label">Collected (12 mo)</span></div>
        </div>
        <div className="stat-card tone-blue anim-rise" style={{ animationDelay: '60ms' }}>
          <span className="stat-icon"><BedDouble size={20} /></span>
          <div><span className="stat-value">{occ.total ? Math.round((occ.occupied / occ.total) * 100) : 0}%</span><span className="stat-label">Occupancy ({occ.occupied}/{occ.total})</span></div>
        </div>
        <div className="stat-card tone-violet anim-rise" style={{ animationDelay: '120ms' }}>
          <span className="stat-icon"><Users size={20} /></span>
          <div><span className="stat-value">{data.genderCounts.reduce((s, g) => s + g.count, 0)}</span><span className="stat-label">Registered patients</span></div>
        </div>
      </div>

      <div className="dash-row">
        <div className="panel grow anim-rise">
          <div className="panel-head"><h3><BarChart3 size={16} /> Monthly revenue</h3></div>
          <Bars data={monthly} />
        </div>
        <div className="panel side-panel anim-rise" style={{ animationDelay: '80ms' }}>
          <div className="panel-head"><h3><Pill size={16} /> Most prescribed</h3></div>
          <Bars data={medicines} color="#0d9488" suffix=" u" />
        </div>
      </div>

      <div className="dash-row">
        <div className="panel grow anim-rise" style={{ animationDelay: '140ms' }}>
          <div className="panel-head"><h3><Stethoscope size={16} /> Top diagnoses</h3></div>
          <Bars data={diagnoses} color="#7c3aed" />
        </div>
      </div>
    </div>
  )
}
