import { Navigate } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Patients from './pages/Patients.jsx'
import Doctors from './pages/Doctors.jsx'
import Appointments from './pages/Appointments.jsx'
import Invoices from './pages/Invoices.jsx'
import Inventory from './pages/Inventory.jsx'
import MedicalRecords from './pages/MedicalRecords.jsx'
import Prescriptions from './pages/Prescriptions.jsx'
import Wards from './pages/Wards.jsx'
import Users from './pages/Users.jsx'
import AuditLog from './pages/AuditLog.jsx'
import Reports from './pages/Reports.jsx'

function Splash() {
  return <div className="splash"><div className="spinner" /></div>
}

function RequireAuth({ roles, children }) {
  const { user, booting } = useAuth()
  if (booting) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, booting } = useAuth()

  if (booting) return <Splash />
  if (!user) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<RequireAuth roles={['admin', 'doctor', 'receptionist']}><Patients /></RequireAuth>} />
        <Route path="/doctors" element={<RequireAuth roles={['admin', 'doctor', 'receptionist']}><Doctors /></RequireAuth>} />
        <Route path="/appointments" element={<RequireAuth roles={['admin', 'doctor', 'receptionist']}><Appointments /></RequireAuth>} />
        <Route path="/records" element={<RequireAuth roles={['admin', 'doctor']}><MedicalRecords /></RequireAuth>} />
        <Route path="/prescriptions" element={<RequireAuth roles={['admin', 'doctor', 'pharmacist']}><Prescriptions /></RequireAuth>} />
        <Route path="/invoices" element={<RequireAuth roles={['admin', 'receptionist']}><Invoices /></RequireAuth>} />
        <Route path="/wards" element={<RequireAuth roles={['admin', 'doctor', 'receptionist']}><Wards /></RequireAuth>} />
        <Route path="/inventory" element={<RequireAuth roles={['admin', 'pharmacist']}><Inventory /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth roles={['admin', 'doctor']}><Reports /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth roles={['admin']}><Users /></RequireAuth>} />
        <Route path="/audit" element={<RequireAuth roles={['admin']}><AuditLog /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
