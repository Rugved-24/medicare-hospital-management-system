import { useEffect, useState } from 'react'
import { Stethoscope, Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const empty = { name: '', specialization: '', phone: '', email: '', fee: '' }

export default function Doctors() {
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const toast = useToast()
  const { user } = useAuth()
  const canWrite = ['admin', 'receptionist'].includes(user?.role)

  const load = () => api.get('/api/doctors').then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/api/doctors/${editingId}`, form)
        toast.success('Doctor updated')
      } else {
        await api.post('/api/doctors', form)
        toast.success('Doctor added')
      }
      setForm(null); setEditingId(null); load()
    } catch (err) { toast.error(err.message) }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this doctor?')) return
    try { await api.del(`/api/doctors/${id}`); toast.info('Doctor deleted'); load() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <div className="toolbar">
        <span className="muted">{items ? `${items.length} on staff` : 'Loading…'}</span>
        {canWrite && <button className="btn primary" onClick={() => { setForm({ ...empty }); setEditingId(null) }}><Plus size={15} /> Add Doctor</button>}
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : (
        <div className="cards-grid two">
          {items.map((d, i) => (
            <article key={d.id} className="panel doctor-card anim-rise" style={{ animationDelay: `${Math.min(i * 45, 300)}ms` }}>
              <div className="avatar lg">{d.name.replace(/^Dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
              <div className="doctor-info">
                <strong>{d.name}</strong>
                <span className="badge teal soft">{d.specialization}</span>
                <span className="muted small">{d.phone || d.email || ''}</span>
              </div>
              <div className="text-right">
                <span className="stat-value small">${Number(d.fee).toFixed(0)}</span>
                <span className="muted tiny">consult</span>
                {canWrite && (
                  <div className="row-gap end">
                    <button className="btn small" onClick={() => { setForm({ ...empty, ...d }); setEditingId(d.id) }}><Pencil size={13} /></button>
                    {user?.role === 'admin' && <button className="btn small danger ghost-danger" onClick={() => remove(d.id)}><Trash2 size={13} /></button>}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {items?.length === 0 && (
        <div className="panel empty-state"><Stethoscope size={34} strokeWidth={1.6} /><p>No doctors yet.</p></div>
      )}

      {form && (
        <Modal title={editingId ? 'Edit Doctor' : 'Add Doctor'} onClose={() => { setForm(null); setEditingId(null) }}>
          <form onSubmit={save} className="form-grid">
            <label>Full name *<input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Specialization *<input required maxLength={80} value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Cardiology" /></label>
            <label>Phone<input maxLength={30} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>Email<input type="email" maxLength={120} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Consultation fee ($)<input type="number" min="0" step="0.01" value={form.fee ?? ''} onChange={(e) => setForm({ ...form, fee: e.target.value })} /></label>
            <div className="form-actions full">
              <button type="button" className="btn" onClick={() => { setForm(null); setEditingId(null) }}>Cancel</button>
              <button type="submit" className="btn primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
