import { useEffect, useState } from 'react'
import { ReceiptText, Plus, Trash2, CircleDollarSign } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { StatusBadge } from './Dashboard.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const empty = { patient_id: '', amount: '', status: 'Pending', description: '' }

export default function Invoices() {
  const [items, setItems] = useState(null)
  const [patients, setPatients] = useState([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const toast = useToast()
  const { user } = useAuth()
  const canWrite = ['admin', 'receptionist'].includes(user?.role)

  const load = () => api.get('/api/invoices', { q }).then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => { if (canWrite) api.get('/api/patients').then(setPatients).catch(() => {}) }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/invoices', form)
      toast.success('Invoice created')
      setForm(null); load()
    } catch (err) { toast.error(err.message) }
  }

  const toggleStatus = async (inv) => {
    try {
      await api.patch(`/api/invoices/${inv.id}/status`, { status: inv.status === 'Paid' ? 'Pending' : 'Paid' })
      toast.success(inv.status === 'Paid' ? 'Marked unpaid' : 'Payment recorded')
      load()
    } catch (err) { toast.error(err.message) }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this invoice?')) return
    try { await api.del(`/api/invoices/${id}`); toast.info('Invoice deleted'); load() }
    catch (err) { toast.error(err.message) }
  }

  const totalPaid = items?.filter((i) => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0) || 0
  const totalPending = items?.filter((i) => i.status === 'Pending').reduce((s, i) => s + Number(i.amount), 0) || 0

  return (
    <div>
      <div className="toolbar">
        <input className="search" placeholder="Search patient or description…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="chip green"><CircleDollarSign size={13} /> Collected: ${totalPaid.toFixed(2)}</span>
        <span className="chip orange">Pending: ${totalPending.toFixed(2)}</span>
        {canWrite && <button className="btn primary" onClick={() => setForm({ ...empty })}><Plus size={15} /> New Invoice</button>}
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr><th>Invoice</th><th>Date</th><th>Patient</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" className="empty-state"><ReceiptText size={30} strokeWidth={1.6} /><p>No invoices found.</p></td></tr>
              ) : items.map((i, idx) => (
                <tr key={i.id} className="anim-fade" style={{ animationDelay: `${Math.min(idx * 25, 200)}ms` }}>
                  <td><strong>INV-{String(i.id).padStart(4, '0')}</strong></td>
                  <td>{i.date}</td>
                  <td>{i.patient_name}</td>
                  <td className="muted truncate-cell">{i.description || '—'}</td>
                  <td><strong>${Number(i.amount).toFixed(2)}</strong></td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>
                    <div className="row-gap end">
                      {canWrite && (
                        <button className={`btn small ${i.status === 'Paid' ? 'warning' : 'success'}`} onClick={() => toggleStatus(i)}>
                          {i.status === 'Paid' ? 'Unpaid' : 'Mark Paid'}
                        </button>
                      )}
                      {user?.role === 'admin' && <button className="btn small danger ghost-danger" onClick={() => remove(i.id)}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title="New Invoice" onClose={() => setForm(null)}>
          <form onSubmit={save} className="form-grid">
            <label>Patient *
              <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Amount ($) *<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Pending</option><option>Paid</option>
              </select>
            </label>
            <label className="full">Description<input maxLength={300} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Consultation, lab tests…" /></label>
            <div className="form-actions full">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn primary">Create Invoice</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
