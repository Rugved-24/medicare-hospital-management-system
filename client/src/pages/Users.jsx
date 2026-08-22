import { useEffect, useState } from 'react'
import { ShieldCheck, Plus, Trash2, KeyRound } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const ROLES = ['admin', 'doctor', 'receptionist', 'pharmacist']
const ROLE_LABELS = { admin: 'Administrator', doctor: 'Doctor', receptionist: 'Receptionist', pharmacist: 'Pharmacist' }

export default function Users() {
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(null)
  const toast = useToast()
  const me = useAuth()

  const load = () => api.get('/api/users').then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/users', form)
      toast.success(`Account created for ${form.full_name}`)
      setForm(null)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const update = async (id, body, msg) => {
    try { await api.put(`/api/users/${id}`, body); if (msg) toast.success(msg); load() }
    catch (err) { toast.error(err.message) }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this staff account?')) return
    try { await api.del(`/api/users/${id}`); toast.info('Account deleted'); load() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <div className="toolbar">
        <span className="muted">{items ? `${items.length} staff account${items.length === 1 ? '' : 's'}` : 'Loading…'}</span>
        <button className="btn primary" onClick={() => setForm({ full_name: '', email: '', role: 'receptionist', password: '' })}>
          <Plus size={15} /> New Account
        </button>
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.map((u, i) => (
                <tr key={u.id} className="anim-fade" style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}>
                  <td><strong>{u.full_name}</strong>{u.id === me.user?.id && <span className="muted"> (you)</span>}</td>
                  <td>{u.email}</td>
                  <td><span className={`role-chip ${u.role}`}>{ROLE_LABELS[u.role]}</span></td>
                  <td><span className={`badge ${u.active ? 'green' : 'red'}`}>{u.active ? 'Active' : 'Disabled'}</span></td>
                  <td className="muted">{(u.created_at || '').slice(0, 10)}</td>
                  <td>
                    <div className="row-gap">
                      <select value="" onChange={(e) => e.target.value && update(u.id, { role: e.target.value }, `Role updated to ${ROLE_LABELS[e.target.value]}`)}>
                        <option value="">Change role…</option>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <button className="btn small" onClick={() => update(u.id, { active: !u.active }, u.active ? 'Account disabled' : 'Account enabled')}>
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn small" title="Reset password"
                        onClick={() => {
                          const pw = window.prompt('New password (min 8 characters):')
                          if (pw) update(u.id, { password: pw }, 'Password reset')
                        }}><KeyRound size={13} /></button>
                      <button className="btn small danger ghost-danger" onClick={() => remove(u.id)} aria-label="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title="New Staff Account" onClose={() => setForm(null)}>
          <form onSubmit={save} className="stack">
            <label>Full name *<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <label>Email *<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Role *
              <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </label>
            <label>Password * (min 8 characters)<input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn primary"><ShieldCheck size={14} /> Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
