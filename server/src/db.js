import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let url = process.env.TURSO_DATABASE_URL
if (!url) {
  const dataDir = path.join(__dirname, '..', 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  url = 'file:' + path.join(dataDir, 'hospital.db')
}

export const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
})

export const q = {
  async all(sql, ...args) {
    return (await db.execute({ sql, args })).rows
  },
  async get(sql, ...args) {
    return (await db.execute({ sql, args })).rows[0]
  },
  async run(sql, ...args) {
    const r = await db.execute({ sql, args })
    return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.rowsAffected }
  },
  async exec(sql) {
    return db.executeMultiple(sql)
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'Male',
  dob TEXT,
  blood_group TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  fee REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Completed','Cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Paid')),
  description TEXT,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','doctor','receptionist','pharmacist')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS medical_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  visit_date TEXT NOT NULL DEFAULT (date('now')),
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  vitals_bp TEXT,
  vitals_temp REAL,
  vitals_pulse INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  record_id INTEGER REFERENCES medical_records(id) ON DELETE SET NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  diagnosis TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Dispensed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  dosage TEXT,
  duration_days INTEGER NOT NULL DEFAULT 1,
  quantity INTEGER NOT NULL DEFAULT 1,
  dispensed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ward TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'General' CHECK (type IN ('General','Private','ICU','Observation')),
  daily_rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Occupied','Maintenance'))
);
CREATE TABLE IF NOT EXISTS admissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  admitted_date TEXT NOT NULL DEFAULT (date('now')),
  discharged_date TEXT,
  notes TEXT
);
`

async function seedIfEmpty() {
  await q.exec(SCHEMA)

  if (!(await q.get('SELECT COUNT(*) AS n FROM users')).n) {
    const tx = await db.transaction('write')
    try {
      const hash = (pw) => bcrypt.hashSync(pw, 10)
      const u = 'INSERT INTO users (email, password_hash, full_name, role) VALUES (?,?,?,?)'
      await tx.execute({ sql: u, args: ['admin@hospital.com', hash('Admin@123'), 'System Administrator', 'admin'] })
      await tx.execute({ sql: u, args: ['sarah.lin@hospital.com', hash('Doctor@123'), 'Dr. Sarah Lin', 'doctor'] })
      await tx.execute({ sql: u, args: ['reception@hospital.com', hash('Front@123'), 'Anna Reyes', 'receptionist'] })
      await tx.execute({ sql: u, args: ['pharmacy@hospital.com', hash('Pharma@123'), 'Marco Diaz', 'pharmacist'] })
      await tx.commit()
      console.log('Default user accounts created')
    } catch (e) { await tx.rollback(); throw e }
  }

  if (!(await q.get('SELECT COUNT(*) AS n FROM rooms')).n) {
    const tx = await db.transaction('write')
    try {
      const r = 'INSERT INTO rooms (ward, number, type, daily_rate) VALUES (?,?,?,?)'
      for (const row of [
        ['Ward A', 'A-101', 'General', 80], ['Ward A', 'A-102', 'General', 80],
        ['Ward A', 'A-103', 'Observation', 120], ['Ward B', 'B-201', 'General', 80],
        ['Ward B', 'B-202', 'Private', 200], ['ICU', 'ICU-01', 'ICU', 500], ['ICU', 'ICU-02', 'ICU', 500]
      ]) await tx.execute({ sql: r, args: row })
      await tx.commit()
    } catch (e) { await tx.rollback(); throw e }
  }

  const hasPatients = (await q.get('SELECT COUNT(*) AS n FROM patients')).n > 0

  if (!hasPatients && !(await q.get('SELECT COUNT(*) AS n FROM prescriptions')).n) {
    const tx = await db.transaction('write')
    try {
      const p = 'INSERT INTO patients (name, gender, dob, blood_group, phone, address) VALUES (?,?,?,?,?,?)'
      for (const row of [
        ['John Carter', 'Male', '1990-04-12', 'O+', '555-0101', '12 Maple St'],
        ['Maria Gomez', 'Female', '1985-09-30', 'A-', '555-0102', '88 Oak Ave'],
        ['Ahmed Khan', 'Male', '1978-01-22', 'B+', '555-0103', '4 Pine Rd']
      ]) await tx.execute({ sql: p, args: row })

      const d = 'INSERT INTO doctors (name, specialization, phone, email, fee) VALUES (?,?,?,?,?)'
      for (const row of [
        ['Dr. Sarah Lin', 'Cardiology', '555-0201', 'sarah.lin@hospital.com', 150],
        ['Dr. James Patel', 'Orthopedics', '555-0202', 'james.patel@hospital.com', 120],
        ['Dr. Emily Chen', 'Pediatrics', '555-0203', 'emily.chen@hospital.com', 100]
      ]) await tx.execute({ sql: d, args: row })

      const a = "INSERT INTO appointments (patient_id, doctor_id, date, time, status, notes) VALUES (?,?,?,?,?,?)"
      const today = new Date().toISOString().slice(0, 10)
      await tx.execute({ sql: a, args: [1, 1, today, '09:30', 'Scheduled', 'Chest pain follow-up'] })
      await tx.execute({ sql: a, args: [2, 3, today, '11:00', 'Scheduled', null] })
      await tx.execute({ sql: a, args: [3, 2, '2026-08-25', '14:15', 'Scheduled', 'Knee pain'] })

      const rec = `INSERT INTO medical_records (patient_id, doctor_id, visit_date, chief_complaint, diagnosis, treatment_plan, vitals_bp, vitals_temp, vitals_pulse)
        VALUES (?,?,?,?,?,?,?,?,?)`
      await tx.execute({ sql: rec, args: [1, 1, '2026-08-10', 'Chest tightness on exertion', 'Stable angina (suspected)', 'ECG ordered; stress test scheduled', '128/82', 36.8, 78] })

      const i = "INSERT INTO invoices (patient_id, amount, status, description) VALUES (?,?,?,?)"
      await tx.execute({ sql: i, args: [1, 150, 'Paid', 'Cardiology consultation'] })
      await tx.execute({ sql: i, args: [2, 340, 'Pending', 'Lab tests and X-ray'] })

      const m = 'INSERT INTO medicines (name, category, quantity, price, expiry_date) VALUES (?,?,?,?,?)'
      for (const row of [
        ['Paracetamol 500mg', 'Analgesic', 240, 2.5, '2027-05-31'],
        ['Amoxicillin 250mg', 'Antibiotic', 8, 5.0, '2026-12-31'],
        ['Ibuprofen 400mg', 'Analgesic', 120, 3.25, '2027-02-28'],
        ['Insulin Glargine', 'Diabetic', 15, 45.0, '2026-10-15']
      ]) await tx.execute({ sql: m, args: row })

      const rx = "INSERT INTO prescriptions (patient_id, doctor_id, date, diagnosis, notes, status) VALUES (?,?,?,?,?,'Pending')"
      const rxRes = await tx.execute({ sql: rx, args: [1, 1, '2026-08-18', 'Stable angina (suspected)', 'Dispense at pharmacy counter'] })
      await tx.execute({
        sql: 'INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration_days, quantity) VALUES (?,?,?,?,?)',
        args: [Number(rxRes.lastInsertRowid), 1, '1 tablet every 8h', 7, 21]
      })

      await tx.commit()
      console.log('Database seeded with sample data')
    } catch (e) { await tx.rollback(); throw e }
  }
}

export const ready = seedIfEmpty().catch((e) => { console.error('DB init failed:', e); process.exit(1) })
