import { useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { api } from '../api.js'
import { useToast } from '../components/Toast.jsx'

const pretty = (action) => action.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

export default function AuditLog() {
  const [items, setItems] = useState(null)
  const [actions, setActions] = useState([])
  const [filter, setFilter] = useState('All')
  const toast = useToast()

  useEffect(() => {
    api.get('/api/audit/actions').then(setActions).catch(() => {})
  }, [])
  useEffect(() => {
    api.get('/api/audit', { action: filter === 'All' ? '' : filter }).then(setItems).catch((e) => toast.error(e.message))
  }, [filter])

  return (
    <div>
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option>
          {actions.map((a) => <option key={a} value={a}>{pretty(a)}</option>)}
        </select>
        <span className="muted">{items ? `${items.length} entr${items.length === 1 ? 'y' : 'ies'} (latest first)` : ''}</span>
      </div>

      {!items ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : items.length === 0 ? (
        <div className="panel empty-state"><ScrollText size={34} strokeWidth={1.6} /><p>No audit entries yet.</p></div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="muted nowrap">{(a.created_at || '').replace('T', ' ').slice(0, 19)}</td>
                  <td>{a.username || '—'}</td>
                  <td><span className="badge blue">{pretty(a.action)}</span></td>
                  <td>{a.entity ? `${a.entity}${a.entity_id ? ` #${a.entity_id}` : ''}` : '—'}</td>
                  <td className="details-cell muted">{a.details || '—'}</td>
                  <td className="muted">{a.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
