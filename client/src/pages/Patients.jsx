import { useEffect, useState } from 'react'
import { Plus, Eye, Pencil, Trash2, Users } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import PatientDrawer from '../components/PatientDrawer.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const empty = { name: '', gender: 'Male', dob: '', blood_group: '', phone: '', address: '' }

export default function Patients() {
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [viewing, setViewing] = useState(null)
  const toast = useToast()
  const { user } = useAuth()
  const canWrite = ['admin', 'receptionist', 'doctor'].includes(user?.role)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/api/patients', { q }).then(setItems).catch((e) => toast.error(e.message))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/api/patients/${editingId}`, form)
        toast.success('Patient updated')
      } else {
        await api.post('/api/patients', form)
        toast.success('Patient added')
      }
      setForm(null); setEditingId(null)
      api.get('/api/patients', { q }).then(setItems)
    } catch (err) { toast.error(err.message) }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this patient and all related data?')) return
    try { await api.del(`/api/patients/${id}`); toast.info('Patient deleted'); setItems((l) => l.filter((i) => i.id !== id)) }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <div className="toolbar">
        <input className="search" placeholder="Search by name, phone or blood group…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canWrite && <button className="btn primary" onClick={() => { setForm({ ...empty }); setEditingId(null) }}><Plus size={15} /> Add Patient</button>}
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Gender</th><th>DOB</th><th>Blood</th><th>Phone</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" className="empty-state"><Users size={30} strokeWidth={1.6} /><p>No patients found.</p></td></tr>
              ) : items.map((p, i) => (
                <tr key={p.id} className="anim-fade" style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}>
                  <td className="muted">{p.id}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.gender}</td>
                  <td>{p.dob || '—'}</td>
                  <td>{p.blood_group && <span className="badge red soft">{p.blood_group}</span>}</td>
                  <td>{p.phone || '—'}</td>
                  <td>
                    <div className="row-gap">
                      <button className="btn small" title="View profile" onClick={() => setViewing(p.id)}><Eye size={13} /></button>
                      {canWrite && <button className="btn small" title="Edit" onClick={() => { setForm({ ...empty, ...p }); setEditingId(p.id) }}><Pencil size={13} /></button>}
                      {isAdmin && <button className="btn small danger ghost-danger" title="Delete" onClick={() => remove(p.id)}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={editingId ? 'Edit Patient' : 'Add Patient'} onClose={() => { setForm(null); setEditingId(null) }}>
          <form onSubmit={save} className="form-grid">
            <label>Full name *<input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Gender
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </label>
            <label>Date of birth<input type="date" value={form.dob || ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></label>
            <label>Blood group
              <select value={form.blood_group || ''} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                <option value="">—</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label>Phone<input maxLength={30} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>Address<input maxLength={200} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <div className="form-actions full">
              <button type="button" className="btn" onClick={() => { setForm(null); setEditingId(null) }}>Cancel</button>
              <button type="submit" className="btn primary">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && <PatientDrawer patientId={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
