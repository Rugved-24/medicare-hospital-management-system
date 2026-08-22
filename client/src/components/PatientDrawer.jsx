import { useEffect, useState } from 'react'
import { X, FileHeart, ReceiptText, CalendarDays, Pill } from 'lucide-react'
import { api } from '../api.js'

const TABS = [
  { key: 'records', label: 'Records', icon: FileHeart },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { key: 'appointments', label: 'Appointments', icon: CalendarDays },
  { key: 'invoices', label: 'Invoices', icon: ReceiptText }
]

export default function PatientDrawer({ patientId, onClose }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('records')

  useEffect(() => {
    api.get(`/api/patients/${patientId}/detail`).then(setData).catch(() => {})
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [patientId])

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <h3>{data?.patient?.name || '…'}</h3>
            <p className="muted small">
              {data && `${data.patient.gender || '—'} · ${data.patient.blood_group || '?'} · DOB ${data.patient.dob || '—'}`}
            </p>
            <p className="muted small">{data?.patient?.phone} {data?.patient?.address ? `· ${data.patient.address}` : ''}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <nav className="drawer-tabs">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        <div className="drawer-body">
          {!data ? <div className="skeleton table-sk" /> : (
            <>
              {tab === 'records' && (data.records.length === 0
                ? <p className="muted center-pad">No medical records.</p>
                : data.records.map((r) => (
                  <article key={r.id} className="record-card compact">
                    <div className="record-head">
                      <strong>{r.visit_date}</strong>
                      <span className="muted small">{r.doctor_name || ''}</span>
                    </div>
                    {r.diagnosis && <p><span className="muted">Diagnosis:</span> {r.diagnosis}</p>}
                    {r.treatment_plan && <p><span className="muted">Plan:</span> {r.treatment_plan}</p>}
                    {r.vitals_bp && <p className="muted small">BP {r.vitals_bp}{r.vitals_pulse ? ` · Pulse ${r.vitals_pulse}` : ''}</p>}
                  </article>
                )))}

              {tab === 'prescriptions' && (data.prescriptions.length === 0
                ? <p className="muted center-pad">No prescriptions.</p>
                : data.prescriptions.map((rx) => (
                  <article key={rx.id} className="record-card compact">
                    <div className="record-head">
                      <strong>RX-{String(rx.id).padStart(4, '0')}</strong>
                      <span className={`badge ${rx.status === 'Dispensed' ? 'green' : 'orange'}`}>{rx.status}</span>
                    </div>
                    <ul className="rx-items">
                      {(rx.items || []).map((it) => (
                        <li key={it.id}><strong>{it.medicine_name}</strong><span>{it.quantity} unit(s) · {it.dosage || ''}</span></li>
                      ))}
                    </ul>
                  </article>
                )))}

              {tab === 'appointments' && (data.appointments.length === 0
                ? <p className="muted center-pad">No appointments.</p>
                : data.appointments.map((a) => (
                  <article key={a.id} className="record-card compact">
                    <div className="record-head">
                      <strong>{a.date} · {a.time}</strong>
                      <span className={`badge ${a.status === 'Completed' ? 'green' : a.status === 'Cancelled' ? 'red' : 'blue'}`}>{a.status}</span>
                    </div>
                    <p>{a.doctor_name} · <span className="muted">{a.specialization}</span></p>
                  </article>
                )))}

              {tab === 'invoices' && (data.invoices.length === 0
                ? <p className="muted center-pad">No invoices.</p>
                : data.invoices.map((i) => (
                  <article key={i.id} className="record-card compact row-between">
                    <div>
                      <strong>INV-{String(i.id).padStart(4, '0')}</strong>
                      <p className="muted small">{i.date} · {i.description || '—'}</p>
                    </div>
                    <div className="text-right">
                      <strong>${Number(i.amount).toFixed(2)}</strong>
                      <div><span className={`badge ${i.status === 'Paid' ? 'green' : 'orange'}`}>{i.status}</span></div>
                    </div>
                  </article>
                )))}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
