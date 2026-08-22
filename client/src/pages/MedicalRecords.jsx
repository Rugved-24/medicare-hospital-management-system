import { useEffect, useState } from 'react'
import { FileHeart, Plus } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const empty = {
  patient_id: '', doctor_id: '', visit_date: today(), chief_complaint: '', diagnosis: '',
  treatment_plan: '', vitals_bp: '', vitals_temp: '', vitals_pulse: '', notes: ''
}

export default function MedicalRecords() {
  const [items, setItems] = useState(null)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const toast = useToast()

  const load = () => api.get('/api/records').then(setItems).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])
  useEffect(() => {
    api.get('/api/patients').then(setPatients).catch(() => {})
    api.get('/api/doctors').then(setDoctors).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/records', form)
      toast.success('Medical record saved')
      setForm(null)
      load()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <div className="toolbar">
        <span className="muted">{items ? `${items.length} record${items.length === 1 ? '' : 's'}` : 'Loading…'}</span>
        <button className="btn primary" onClick={() => setForm({ ...empty })}><Plus size={15} /> New Record</button>
      </div>
      {error && <div className="alert error">{error}</div>}

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : items.length === 0 ? (
        <div className="panel empty-state"><FileHeart size={34} strokeWidth={1.6} /><p>No medical records yet.</p></div>
      ) : (
        <div className="timeline">
          {items.map((r, i) => (
            <article key={r.id} className="record-card anim-rise" style={{ animationDelay: `${Math.min(i * 45, 300)}ms` }}>
              <div className="record-head">
                <div>
                  <strong>{r.patient_name}</strong>
                  <span className="muted"> · {r.doctor_name || 'Unassigned'}</span>
                </div>
                <span className="badge blue">{r.visit_date}</span>
              </div>
              {(r.vitals_bp || r.vitals_temp || r.vitals_pulse) && (
                <div className="vitals-row">
                  {r.vitals_bp && <span className="vital">BP {r.vitals_bp}</span>}
                  {r.vitals_temp != null && r.vitals_temp !== '' && <span className="vital">Temp {r.vitals_temp}°C</span>}
                  {r.vitals_pulse != null && r.vitals_pulse !== '' && <span className="vital">Pulse {r.vitals_pulse}</span>}
                </div>
              )}
              <dl className="record-body">
                {r.chief_complaint && <div><dt>Complaint</dt><dd>{r.chief_complaint}</dd></div>}
                {r.diagnosis && <div><dt>Diagnosis</dt><dd>{r.diagnosis}</dd></div>}
                {r.treatment_plan && <div><dt>Treatment</dt><dd>{r.treatment_plan}</dd></div>}
                {r.notes && <div><dt>Notes</dt><dd>{r.notes}</dd></div>}
              </dl>
            </article>
          ))}
        </div>
      )}

      {form && (
        <Modal title="New Medical Record" onClose={() => setForm(null)} wide>
          <form onSubmit={save} className="form-grid">
            <label>Patient *
              <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Doctor
              <select value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Select doctor…</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Visit date *<input type="date" required value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} /></label>
            <label>Blood pressure<input placeholder="120/80" value={form.vitals_bp || ''} onChange={(e) => setForm({ ...form, vitals_bp: e.target.value })} /></label>
            <label>Temperature (°C)<input type="number" step="0.1" min="25" max="45" value={form.vitals_temp ?? ''} onChange={(e) => setForm({ ...form, vitals_temp: e.target.value })} /></label>
            <label>Pulse (bpm)<input type="number" min="20" max="250" value={form.vitals_pulse ?? ''} onChange={(e) => setForm({ ...form, vitals_pulse: e.target.value })} /></label>
            <label className="full">Chief complaint<input value={form.chief_complaint || ''} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} /></label>
            <label className="full">Diagnosis<input value={form.diagnosis || ''} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></label>
            <label className="full">Treatment plan<textarea rows="2" value={form.treatment_plan || ''} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} /></label>
            <div className="form-actions full">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn primary">Save Record</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
