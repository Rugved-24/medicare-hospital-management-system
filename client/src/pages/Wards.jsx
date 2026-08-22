import { useEffect, useState } from 'react'
import { BedDouble, LogOut, Plus, Wrench, DoorOpen } from 'lucide-react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'

const TYPE_COLORS = { General: 'blue', Private: 'violet', ICU: 'red', Observation: 'orange' }

export default function Wards() {
  const [rooms, setRooms] = useState(null)
  const [patients, setPatients] = useState([])
  const [admitFor, setAdmitFor] = useState(null)
  const [addRoom, setAddRoom] = useState(null)
  const toast = useToast()

  const load = () => api.get('/api/wards/rooms').then(setRooms).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (rooms) api.get('/api/patients').then(setPatients).catch(() => {})
  }, [rooms])

  const admit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/wards/admit', admitFor)
      toast.success('Patient admitted')
      setAdmitFor(null)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const discharge = async (roomId, admissionId) => {
    if (!window.confirm('Discharge the patient and generate the stay invoice?')) return
    try {
      const res = await api.post(`/api/wards/discharge/${admissionId}`)
      toast.success(`Discharged — billed $${Number(res.billed_amount).toFixed(2)} for ${res.billed_days} day(s)`)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const toggleMaintenance = async (room) => {
    const next = room.status === 'Maintenance' ? 'Available' : 'Maintenance'
    try { await api.patch(`/api/wards/rooms/${room.id}/status`, { status: next }); load() }
    catch (err) { toast.error(err.message) }
  }

  const createRoom = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/wards/rooms', addRoom)
      toast.success('Room added')
      setAddRoom(null)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const occupied = rooms?.filter((r) => r.status === 'Occupied').length || 0

  return (
    <div>
      <div className="toolbar">
        <span className="chip blue">{occupied} of {rooms?.length ?? '…'} rooms occupied</span>
        <button className="btn primary" onClick={() => setAddRoom({ ward: '', number: '', type: 'General', daily_rate: '' })}>
          <Plus size={15} /> Add Room
        </button>
      </div>

      {!rooms ? (
        <div className="panel"><div className="skeleton table-sk" /></div>
      ) : (
        <div className="room-grid">
          {rooms.map((r, i) => (
            <article key={r.id} className={`room-card st-${r.status.toLowerCase()} anim-rise`} style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}>
              <header>
                <span className={`badge ${TYPE_COLORS[r.type] || 'gray'}`}>{r.type}</span>
                <strong>{r.number}</strong>
              </header>
              <p className="muted small">{r.ward} · ${Number(r.daily_rate).toFixed(0)}/day</p>
              <div className="room-status-line">
                {r.status === 'Occupied'
                  ? <><DoorOpen size={13} /> {r.patient_name || 'Occupied'}</>
                  : <>{r.status}</>}
              </div>
              <footer>
                {r.status === 'Available' && (
                  <button className="btn small primary" onClick={() => setAdmitFor({ patient_id: '', room_id: r.id, notes: '' })}>Admit</button>
                )}
                {r.status === 'Occupied' && (
                  <button className="btn small warning" onClick={() => discharge(r.id, r.admission_id)}><LogOut size={13} /> Discharge</button>
                )}
                {(r.status === 'Available' || r.status === 'Maintenance') && (
                  <button className="btn small" title="Toggle maintenance" onClick={() => toggleMaintenance(r)}><Wrench size={13} /></button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {admitFor && (
        <Modal title={`Admit to ${rooms.find((r) => r.id === Number(admitFor.room_id))?.number}`} onClose={() => setAdmitFor(null)}>
          <form onSubmit={admit} className="stack">
            <label>Patient *
              <select required value={admitFor.patient_id} onChange={(e) => setAdmitFor({ ...admitFor, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Notes<textarea rows="2" value={admitFor.notes || ''} onChange={(e) => setAdmitFor({ ...admitFor, notes: e.target.value })} /></label>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setAdmitFor(null)}>Cancel</button>
              <button type="submit" className="btn primary">Confirm Admission</button></div>
          </form>
        </Modal>
      )}

      {addRoom && (
        <Modal title="Add Room" onClose={() => setAddRoom(null)}>
          <form onSubmit={createRoom} className="form-grid">
            <label>Ward *<input required value={addRoom.ward} onChange={(e) => setAddRoom({ ...addRoom, ward: e.target.value })} placeholder="Ward C" /></label>
            <label>Room number *<input required value={addRoom.number} onChange={(e) => setAddRoom({ ...addRoom, number: e.target.value })} placeholder="C-301" /></label>
            <label>Type
              <select value={addRoom.type} onChange={(e) => setAddRoom({ ...addRoom, type: e.target.value })}>
                {Object.keys(TYPE_COLORS).map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Daily rate ($)<input type="number" min="0" step="0.01" value={addRoom.daily_rate} onChange={(e) => setAddRoom({ ...addRoom, daily_rate: e.target.value })} /></label>
            <div className="form-actions full"><button type="button" className="btn" onClick={() => setAddRoom(null)}>Cancel</button>
              <button type="submit" className="btn primary">Add Room</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
