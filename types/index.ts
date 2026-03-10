export interface Employee {
  id: string
  name: string
  designation: string
  department: string
  join_date?: string
  phone?: string
  email?: string
  salary: number
  status: 'active' | 'leave' | 'wfh' | 'inactive'
  color?: string
}

export interface AttendanceRecord {
  id?: string
  emp_id: string
  emp_name: string
  date: string
  check_in: string | null
  check_out: string | null
  status: string
  hours_worked: number
  ot_hours: number
  st_hours: number
  late_mins: number
  is_night_shift: boolean
  remarks?: string
  source?: string
}

export interface LeaveRequest {
  id?: string
  emp_id: string
  emp_name: string
  type: string
  from_date: string
  to_date: string
  days: number
  reason: string
  contact?: string
  applied_on?: string
  status: string
  approved_by?: string
  approved_on?: string
  remarks?: string
}

export interface PayrollRecord {
  id?: string
  period: string
  month: number
  year: number
  emp_id: string
  emp_name: string
  gross: number
  basic: number
  hra: number
  transport: number
  other_allow: number
  pf_deduction: number
  tds: number
  lop_deduction: number
  net: number
  days_present: number
  days_absent: number
  ot_hours: number
  status: string
}

export interface Appraisal {
  id?: string
  emp_id: string
  year: number
  q1: number
  q2: number
  q3: number
  q4: number
  kpi: number
  feedback?: string
}

export interface LeavePolicy {
  annual_days: number
  public_holidays: number
  carry_forward: number
  grace_minutes: number
  late_threshold_mins: number
  max_late_per_month: number
  min_hours_full_day: number
  min_hours_half_day: number
  shift_start: string
  shift_end: string
  encashment: boolean
}

export interface Holiday {
  id?: string
  name: string
  date: string
  type: string
}
