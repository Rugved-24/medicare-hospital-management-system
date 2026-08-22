import { useEffect, useState } from 'react'
import { Pill, Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const empty = { name: '', category: '', quantity: '', price: '', expiry_date: '' }

export default function Inventory() {
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const toast = useToast()
  const { user } = useAuth()
  const canWrite = ['admin', 'pharmacist'].includes(user?.role)

  const load = () => api.get('/api/inventory', { q }).then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/api/inventory/${editingId}`, form)
        toast.success('Medicine updated')
      } else {
        await api.post('/api/inventory', form)
        toast.success('Medicine added')
      }
      setForm(null); setEditingId(null); load()
    } catch (err) { toast.error(err.message) }
  }

  const adjustStock = async (id, delta) => {
    try {
      const updated = await api.patch(`/api/inventory/${id}/stock`, { delta })
      setItems((list) => list.map((i) => (i.id === id ? updated : i)))
    } catch (err) { toast.error(err.message) }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this medicine?')) return
    try { await api.del(`/api/inventory/${id}`); toast.info('Medicine deleted'); load() }
    catch (err) { toast.error(err.message) }
  }

  const isExpired = (d) => d && d < new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="toolbar">
        <input className="search" placeholder="Search medicine or category…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canWrite && <button className="btn primary" onClick={() => { setForm({ ...empty }); setEditingId(null) }}><Plus size={15} /> Add Medicine</button>}
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Price</th><th>Expiry</th><th>Adjust</th><th></th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" className="empty-state"><Pill size={30} strokeWidth={1.6} /><p>No medicines found.</p></td></tr>
              ) : items.map((m, i) => (
                <tr key={m.id} className={`anim-fade${m.quantity <= 10 ? ' row-low' : ''}`} style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.category || '—'}</td>
                  <td><span className={`badge ${m.quantity === 0 ? 'red' : m.quantity <= 10 ? 'orange' : 'green'}`}>{m.quantity}{m.quantity <= 10 ? ' low' : ''}</span></td>
                  <td>${Number(m.price).toFixed(2)}</td>
                  <td className={isExpired(m.expiry_date) ? 'text-danger' : ''}>
                    {m.expiry_date || '—'}{isExpired(m.expiry_date) && ' (expired)'}
                  </td>
                  <td>
                    {canWrite && (
                      <div className="row-gap">
                        <button className="btn tiny" onClick={() => adjustStock(m.id, -10)}>−10</button>
                        <button className="btn tiny" onClick={() => adjustStock(m.id, -1)}>−1</button>
                        <button className="btn tiny success" onClick={() => adjustStock(m.id, +1)}>+1</button>
                        <button className="btn tiny success" onClick={() => adjustStock(m.id, +10)}>+10</button>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="row-gap end">
                      {canWrite && <button className="btn small" onClick={() => { setForm({ ...empty, ...m }); setEditingId(m.id) }}><Pencil size={13} /></button>}
                      {user?.role === 'admin' && <button className="btn small danger ghost-danger" onClick={() => remove(m.id)}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={editingId ? 'Edit Medicine' : 'Add Medicine'} onClose={() => { setForm(null); setEditingId(null) }}>
          <form onSubmit={save} className="form-grid">
            <label>Name *<input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Category<input maxLength={60} value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Antibiotic" /></label>
            <label>Quantity<input type="number" min="0" value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
            <label>Price ($)<input type="number" min="0" step="0.01" value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
            <label>Expiry date<input type="date" value={form.expiry_date || ''} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></label>
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
