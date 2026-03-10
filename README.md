# Motionbrains HRMS — Next.js + Supabase

HR & Payroll System converted from HTML to Next.js + Supabase.

---

## Setup (5 steps)

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Create Supabase project
1. Go to https://supabase.com → New Project
2. Name: `motionbrains-hrms`
3. Database password: (save this)
4. Region: `ap-south-1` (Mumbai — closest to Jaipur)

### Step 3 — Copy credentials
1. Supabase → Settings → API
2. Copy **Project URL** and **anon/public key**
3. Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
```

### Step 4 — Run database schema
1. Supabase → SQL Editor → New Query
2. Paste entire contents of `supabase/schema.sql`
3. Click **Run**
4. ✅ All tables + seed data created

### Step 5 — Start the app
```bash
npm run dev
```
Open http://localhost:3000

---

## Login Credentials
| Role  | Username | Password |
|-------|----------|----------|
| Admin | admin    | admin123 |
| HR    | hr       | hr123    |
| Employee | MB001 | emp123  |

---

## Features
- ✅ Dashboard with live stats
- ✅ Employee Management (Add/Edit/Delete)
- ✅ Attendance — Mark daily with check-in/out
- ✅ **Missing checkout → Leave** (MotionBrains policy)
- ✅ Night shift auto-detection
- ✅ Overtime & Short-time calculation
- ✅ Leave Management (Apply, Approve, Balance)
- ✅ Biometric file sync (.txt from eSSL/ZKTeco)
- ✅ Payroll processing (50/30/10/10 split)
- ✅ Payslip Generator (print ready)
- ✅ Performance Appraisals (Q1-Q4)
- ✅ Reports & CSV export

## Attendance Rules (MotionBrains Policy)
| Condition | Result |
|-----------|--------|
| No check-in | Absent |
| Check-in, no checkout | **Leave** |
| < 4.5 hours worked | Leave/LOP |
| 4.5–9 hours worked | Half Day |
| 9+ hours worked | Full Day |
| 45+ min late arrival | Half Day |
| Checkout before checkin | Night Shift |

---

## Deployment (Vercel)
```bash
npm install -g vercel
vercel
# Add env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```
