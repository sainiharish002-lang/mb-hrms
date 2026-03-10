// ================================================================
// Core Attendance Calculation Logic
// Ported from original HTML JS functions
// ================================================================

export interface AttendanceCalc {
  status: 'Full Day' | 'Half Day' | 'Leave' | 'Absent'
  hours_worked: number
  ot_hours: number
  st_hours: number
  late_mins: number
  is_night_shift: boolean
}

export interface PolicyCfg {
  shift_start?: string        // default "09:00"
  shift_end?: string          // default "18:00"
  grace_minutes?: number      // default 15
  late_threshold_mins?: number // default 45
  min_hours_full_day?: number  // default 9
  min_hours_half_day?: number  // default 4.5
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

// ----------------------------------------------------------------
// MAIN: calculateAttendance
// Rule 1: No check_in                 → Absent
// Rule 2: check_in + no check_out     → Leave  (missing checkout policy)
// Rule 3: < 4.5 hrs                   → Leave/LOP
// Rule 4: 4.5–9 hrs                   → Half Day
// Rule 5: 9+ hrs                      → Full Day
// Rule 6: 45+ min late                → Half Day (overrides Full Day)
// Rule 7: checkout < checkin          → Night Shift
// ----------------------------------------------------------------
export function calculateAttendance(
  checkIn: string | null,
  checkOut: string | null,
  policy?: PolicyCfg
): AttendanceCalc {
  const cfg = {
    shift_start: policy?.shift_start ?? '09:00',
    shift_end: policy?.shift_end ?? '18:00',
    grace_minutes: policy?.grace_minutes ?? 15,
    late_threshold_mins: policy?.late_threshold_mins ?? 45,
    min_hours_full_day: policy?.min_hours_full_day ?? 9,
    min_hours_half_day: policy?.min_hours_half_day ?? 4.5,
  }

  // Rule 1: Absent
  if (!checkIn && !checkOut) {
    return { status: 'Absent', hours_worked: 0, ot_hours: 0, st_hours: 0, late_mins: 0, is_night_shift: false }
  }

  // Rule 2: Missing checkout = Leave
  if (checkIn && !checkOut) {
    return { status: 'Leave', hours_worked: 0, ot_hours: 0, st_hours: 0, late_mins: 0, is_night_shift: false }
  }

  // Both present — calculate
  const BASE = '2000-01-01'
  let start = new Date(`${BASE}T${checkIn}`)
  let end   = new Date(`${BASE}T${checkOut}`)

  // Rule 7: Night shift detection
  const isNightShift = end < start
  if (isNightShift) end = new Date(end.getTime() + 86400000)

  const hoursWorked = (end.getTime() - start.getTime()) / 3600000

  // Late arrival
  const shiftStartMins = timeToMins(cfg.shift_start)
  const shiftEndMins   = timeToMins(cfg.shift_end)
  const checkInMins    = timeToMins(checkIn!)
  const checkOutMins   = timeToMins(checkOut!)
  const graceEnd       = shiftStartMins + cfg.grace_minutes

  let lateMins = 0
  if (checkInMins > graceEnd) lateMins = checkInMins - shiftStartMins

  // Overtime (worked beyond shift end)
  let otHours = 0
  if (!isNightShift && checkOutMins > shiftEndMins + cfg.grace_minutes) {
    otHours = (checkOutMins - shiftEndMins) / 60
  }
  if (isNightShift) otHours = Math.max(0, hoursWorked - cfg.min_hours_full_day)

  // Short time (left before shift end)
  let stHours = 0
  if (otHours === 0 && !isNightShift && checkOutMins < shiftEndMins - cfg.grace_minutes) {
    stHours = (shiftEndMins - checkOutMins) / 60
  }

  // Status
  let status: AttendanceCalc['status']
  if (hoursWorked < cfg.min_hours_half_day)      status = 'Leave'
  else if (hoursWorked < cfg.min_hours_full_day) status = 'Half Day'
  else                                            status = 'Full Day'

  // Rule 6: 45+ min late → Half Day
  if (lateMins >= cfg.late_threshold_mins && status === 'Full Day') status = 'Half Day'

  return {
    status,
    hours_worked: Math.round(hoursWorked * 100) / 100,
    ot_hours:     Math.round(otHours * 100) / 100,
    st_hours:     Math.round(stHours * 100) / 100,
    late_mins:    Math.round(lateMins),
    is_night_shift: isNightShift,
  }
}

// ----------------------------------------------------------------
// Payroll calculation (50/30/10/10 split)
// ----------------------------------------------------------------
export function calculatePayroll(salary: number, daysPresent: number, totalDays: number, otHours = 0) {
  const perDay    = salary / totalDays
  const earnedGross = perDay * daysPresent
  const lopDays   = totalDays - daysPresent
  const lopDed    = perDay * lopDays

  const basic     = Math.round(earnedGross * 0.50)
  const hra       = Math.round(earnedGross * 0.30)
  const transport = Math.round(earnedGross * 0.10)
  const allowance = Math.round(earnedGross * 0.10)
  const gross     = basic + hra + transport + allowance
  const pf        = Math.round(basic * 0.12)
  const tds       = gross > 25000 ? Math.round(gross * 0.10) : 0
  const net       = gross - pf - tds

  return { basic, hra, transport, other_allow: allowance, gross, pf_deduction: pf, tds, lop_deduction: Math.round(lopDed), net }
}

// ----------------------------------------------------------------
// Leave balance calculation
// ----------------------------------------------------------------
export function getLeaveBalance(
  leaves: { type: string; days: number }[],
  annualDays = 23,
  phDays = 12
) {
  const paidTypes = ['annual', 'casual', 'sick']
  const paidUsed  = leaves.filter(l => paidTypes.includes(l.type)).reduce((s, l) => s + l.days, 0)
  const phUsed    = leaves.filter(l => l.type === 'public-holiday').reduce((s, l) => s + l.days, 0)
  const unpaid    = leaves.filter(l => l.type === 'unpaid').reduce((s, l) => s + l.days, 0)
  const remaining = annualDays - paidUsed
  return {
    paid_used: paidUsed,
    ph_used: phUsed,
    unpaid_used: unpaid,
    remaining: Math.max(0, remaining),
    lop_days: remaining < 0 ? Math.abs(remaining) : 0,
    total: annualDays + phDays,
  }
}
