import { useEffect, useState } from 'react'
import { CalendarDays, Plus, Trash2, Check, X, ReceiptText } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { StatusBadge } from './Dashboard.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const empty = { patient_id: '', doctor_id: '', date: today(), time: '09:00', notes: '' }

export default function Appointments() {
  const [items, setItems] = useState(null)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const toast = useToast()
  const { user } = useAuth()
  const canWrite = ['admin', 'receptionist', 'doctor'].includes(user?.role)

  const load = () => api.get('/api/appointments', { q, status: statusFilter }).then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, statusFilter])
  useEffect(() => {
    api.get('/api/patients').then(setPatients).catch(() => {})
    api.get('/api/doctors').then(setDoctors).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/appointments', form)
      toast.success('Appointment booked')
      setForm(null); load()
    } catch (err) { toast.error(err.message) }
  }

  const setStatus = async (id, status) => {
    try { await api.put(`/api/appointments/${id}`, { status }); toast.success(`Marked ${status.toLowerCase()}`); load() }
    catch (err) { toast.error(err.message) }
  }

  const createInvoice = async (a) => {
    try {
      await api.post('/api/invoices', {
        patient_id: a.patient_id, appointment_id: a.id, amount: a.fee,
        status: 'Pending', description: `${a.specialization} consultation — ${a.date}`
      })
      toast.success('Invoice created in Billing')
    } catch (err) { toast.error(err.message) }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this appointment?')) return
    try { await api.del(`/api/appointments/${id}`); toast.info('Appointment deleted'); load() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <div className="toolbar">
        <input className="search" placeholder="Search patient or doctor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {['All', 'Scheduled', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
        </select>
        {canWrite && <button className="btn primary" onClick={() => setForm({ ...empty })}><Plus size={15} /> Book Appointment</button>}
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr><th>Date</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="6" className="empty-state"><CalendarDays size={30} strokeWidth={1.6} /><p>No appointments found.</p></td></tr>
              ) : items.map((a, i) => (
                <tr key={a.id} className="anim-fade" style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}>
                  <td>{a.date}</td>
                  <td>{a.time}</td>
                  <td><strong>{a.patient_name}</strong></td>
                  <td>{a.doctor_name} <span className="muted">· {a.specialization}</span></td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div className="row-gap">
                      {canWrite && a.status === 'Scheduled' && (<>
                        <button className="btn small success" title="Complete" onClick={() => setStatus(a.id, 'Completed')}><Check size={13} /></button>
                        <button className="btn small warning" title="Cancel" onClick={() => setStatus(a.id, 'Cancelled')}><X size={13} /></button>
                      </>)}
                      {['admin', 'receptionist'].includes(user?.role) && a.status === 'Completed' && (
                        <button className="btn small" onClick={() => createInvoice(a)}><ReceiptText size={13} /> Invoice</button>
                      )}
                      {user?.role === 'admin' && (
                        <button className="btn small danger ghost-danger" onClick={() => remove(a.id)}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title="Book Appointment" onClose={() => setForm(null)}>
          <form onSubmit={save} className="form-grid">
            <label>Patient *
              <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Doctor *
              <select required value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Select doctor…</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
              </select>
            </label>
            <label>Date *<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>Time *<input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
            <label className="full">Notes<textarea rows="2" maxLength={500} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="form-actions full">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn primary">Book</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
