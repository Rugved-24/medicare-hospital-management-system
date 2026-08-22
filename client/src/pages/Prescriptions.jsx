import { useEffect, useState } from 'react'
import { Plus, Pill, Trash2, PackageCheck, TriangleAlert } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'

const today = () => new Date().toISOString().slice(0, 10)

export default function Prescriptions() {
  const [items, setItems] = useState(null)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [medicines, setMedicines] = useState([])
  const [filter, setFilter] = useState('All')
  const [form, setForm] = useState(null)
  const toast = useToast()

  const load = () => api.get('/api/prescriptions', { status: filter }).then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [filter])
  useEffect(() => {
    api.get('/api/patients').then(setPatients).catch(() => {})
    api.get('/api/doctors').then(setDoctors).catch(() => {})
    api.get('/api/inventory').then(setMedicines).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/prescriptions', form)
      toast.success('Prescription created')
      setForm(null)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const dispense = async (rx) => {
    try {
      await api.patch(`/api/prescriptions/${rx.id}/dispense`)
      toast.success(`Dispensed ${rx.items.length} item(s) — stock updated`)
      load()
    } catch (err) {
      if (err.status === 409 && err.data?.shortages) {
        toast.error(err.data.shortages.map((s) => `${s.medicine}: need ${s.required}, have ${s.available}`).join(' · '))
      } else {
        toast.error(err.message)
      }
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this prescription?')) return
    try { await api.del(`/api/prescriptions/${id}`); toast.info('Prescription deleted'); load() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {['All', 'Pending', 'Dispensed'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn primary" onClick={() => setForm({
          patient_id: '', doctor_id: '', date: today(), diagnosis: '', notes: '',
          items: [{ medicine_id: '', dosage: '', duration_days: 1, quantity: 1 }]
        })}><Plus size={15} /> New Prescription</button>
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : items.length === 0 ? (
        <div className="panel empty-state"><Pill size={34} strokeWidth={1.6} /><p>No prescriptions found.</p></div>
      ) : (
        <div className="cards-grid two">
          {items.map((rx, i) => (
            <article key={rx.id} className="panel rx-card anim-rise" style={{ animationDelay: `${Math.min(i * 45, 300)}ms` }}>
              <div className="record-head">
                <div>
                  <strong>RX-{String(rx.id).padStart(4, '0')}</strong> · {rx.patient_name}
                  <span className="muted"> · {rx.doctor_name || '—'}</span>
                </div>
                <div className="row-gap">
                  <span className={`badge ${rx.status === 'Dispensed' ? 'green' : 'orange'}`}>{rx.status}</span>
                  {rx.status === 'Pending' && (
                    <button className="btn small success" onClick={() => dispense(rx)}><PackageCheck size={13} /> Dispense</button>
                  )}
                  <button className="btn small danger ghost-danger" onClick={() => remove(rx.id)} aria-label="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="muted small">{rx.date}{rx.diagnosis ? ` · ${rx.diagnosis}` : ''}</p>
              <ul className="rx-items">
                {rx.items.map((it) => (
                  <li key={it.id}>
                    <strong>{it.medicine_name}</strong>
                    <span>{it.dosage || ''} · {it.quantity} unit(s){it.duration_days ? ` / ${it.duration_days}d` : ''}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {form && (
        <Modal title="New Prescription" onClose={() => setForm(null)} wide>
          <form onSubmit={save} className="stack">
            <div className="form-grid">
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
              <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label>Diagnosis<input value={form.diagnosis || ''} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></label>
            </div>

            <div className="rx-builder">
              <h4><TriangleAlert size={14} /> Medicines</h4>
              {form.items.map((it, idx) => (
                <div key={idx} className="rx-item-row">
                  <select required value={it.medicine_id}
                    onChange={(e) => {
                      const items = [...form.items]
                      items[idx] = { ...items[idx], medicine_id: e.target.value }
                      setForm({ ...form, items })
                    }}>
                    <option value="">Medicine…</option>
                    {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} (stock {m.quantity})</option>)}
                  </select>
                  <input placeholder="Dosage e.g. 1 tab 8h" value={it.dosage}
                    onChange={(e) => {
                      const items = [...form.items]
                      items[idx] = { ...items[idx], dosage: e.target.value }
                      setForm({ ...form, items })
                    }} />
                  <input type="number" min="1" max="365" value={it.duration_days} title="Duration (days)"
                    onChange={(e) => {
                      const items = [...form.items]
                      items[idx] = { ...items[idx], duration_days: Number(e.target.value) }
                      setForm({ ...form, items })
                    }} />
                  <input type="number" min="1" max="10000" value={it.quantity} title="Quantity"
                    onChange={(e) => {
                      const items = [...form.items]
                      items[idx] = { ...items[idx], quantity: Number(e.target.value) }
                      setForm({ ...form, items })
                    }} />
                  {form.items.length > 1 && (
                    <button type="button" className="btn tiny danger" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== idx) })}>×</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn small" onClick={() => setForm({ ...form, items: [...form.items, { medicine_id: '', dosage: '', duration_days: 1, quantity: 1 }] })}>
                + Add medicine
              </button>
            </div>

            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn primary">Create Prescription</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
