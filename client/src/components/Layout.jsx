import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Stethoscope, CalendarDays, ReceiptText, Pill,
  FileHeart, BedDouble, BarChart3, ShieldCheck, ScrollText, LogOut, Activity
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'doctor', 'receptionist', 'pharmacist'] },
  { to: '/patients', label: 'Patients', icon: Users, roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/doctors', label: 'Doctors', icon: Stethoscope, roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/records', label: 'Medical Records', icon: FileHeart, roles: ['admin', 'doctor'] },
  { to: '/prescriptions', label: 'Prescriptions', icon: Pill, roles: ['admin', 'doctor', 'pharmacist'] },
  { to: '/invoices', label: 'Billing', icon: ReceiptText, roles: ['admin', 'receptionist'] },
  { to: '/wards', label: 'Wards & Rooms', icon: BedDouble, roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/inventory', label: 'Pharmacy Stock', icon: Pill, roles: ['admin', 'pharmacist'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'doctor'] },
  { to: '/users', label: 'Staff Accounts', icon: ShieldCheck, roles: ['admin'] },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['admin'] }
]

const ROLE_LABELS = { admin: 'Administrator', doctor: 'Doctor', receptionist: 'Receptionist', pharmacist: 'Pharmacist' }

export default function Layout({ children }) {
  const location = useLocation()
  const { user, logout } = useAuth()
  const items = NAV.filter((n) => n.roles.includes(user?.role))
  const current = items.find((n) => n.to === location.pathname)
  const initials = (user?.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><Activity size={22} strokeWidth={2.4} /></span>
          <div>
            <h1>MediCare</h1>
            <p>Hospital Suite</p>
          </div>
        </div>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={17} strokeWidth={2.1} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{initials}</div>
          <div className="who">
            <strong>{user?.full_name}</strong>
            <span>{ROLE_LABELS[user?.role] || user?.role}</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <h2 key={location.pathname} className="page-title">{current ? current.label : 'Dashboard'}</h2>
          <div className="topbar-right">
            <span className={`role-chip ${user?.role}`}>{ROLE_LABELS[user?.role]}</span>
          </div>
        </header>
        <div className="page-body" key={location.pathname}>
          {children}
        </div>
      </main>
    </div>
  )
}
