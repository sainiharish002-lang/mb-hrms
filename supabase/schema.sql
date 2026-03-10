-- ================================================================
-- MOTIONBRAINS HRMS — Supabase Database Schema
-- Run this FULL script in Supabase → SQL Editor → Run
-- ================================================================

-- ----------------------------------------------------------------
-- EMPLOYEES
-- ----------------------------------------------------------------
create table if not exists employees (
  id           text primary key,          -- MB001, MB002...
  name         text not null,
  designation  text default '',
  department   text default '',
  join_date    date,
  phone        text default '',
  email        text default '',
  salary       numeric(10,2) default 0,
  status       text default 'active',     -- active|leave|wfh|inactive
  color        text default '#1E6FD9',
  created_at   timestamptz default now()
);

-- Seed employees (same as original HTML)
insert into employees (id, name, designation, department, salary, status, color) values
  ('MB001','Vikash Joshi','Sr. Designer','Production',42000,'active','#6C5CE7'),
  ('MB002','Rahul Kapoor','Graphic Artist','Design',28000,'active','#1E6FD9'),
  ('MB003','Priya Sharma','Marketing Executive','Marketing',24000,'active','#0DBF7E'),
  ('MB004','Suresh Malhotra','Accountant','Accounts',35000,'active','#F5A623'),
  ('MB005','Neha Batra','Sales Manager','Sales',38000,'active','#F04A4A'),
  ('MB006','Amit Verma','Production Head','Production',55000,'active','#3B8EFF'),
  ('MB007','Deepika Rao','HR Executive','HR',26000,'active','#A29BFE'),
  ('MB008','Rajesh Kumar','IT Support','IT',22000,'active','#00D9A3')
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- ATTENDANCE
-- ----------------------------------------------------------------
create table if not exists attendance (
  id           uuid primary key default gen_random_uuid(),
  emp_id       text references employees(id) on delete cascade,
  emp_name     text,
  date         date not null,
  check_in     text,           -- "09:15" — stored as text HH:MM
  check_out    text,           -- NULL = missing checkout → Leave
  status       text,           -- Full Day|Half Day|Leave|Absent
  hours_worked numeric(5,2) default 0,
  ot_hours     numeric(5,2) default 0,
  st_hours     numeric(5,2) default 0,
  late_mins    int default 0,
  is_night_shift boolean default false,
  remarks      text default '',
  source       text default 'manual',   -- manual|biometric
  created_at   timestamptz default now(),
  unique(emp_id, date)
);

-- ----------------------------------------------------------------
-- LEAVE REQUESTS
-- ----------------------------------------------------------------
create table if not exists leave_requests (
  id           uuid primary key default gen_random_uuid(),
  emp_id       text references employees(id) on delete cascade,
  emp_name     text,
  type         text not null,     -- annual|casual|sick|unpaid|public-holiday
  from_date    date not null,
  to_date      date not null,
  days         numeric(4,1) not null,
  reason       text default '',
  contact      text default '',
  applied_on   date default current_date,
  status       text default 'pending',  -- pending|approved|rejected
  approved_by  text default '',
  approved_on  date,
  remarks      text default '',
  created_at   timestamptz default now()
);

-- ----------------------------------------------------------------
-- PAYROLL
-- ----------------------------------------------------------------
create table if not exists payroll (
  id              uuid primary key default gen_random_uuid(),
  period          text not null,        -- "March 2026"
  month           int not null,
  year            int not null,
  emp_id          text references employees(id) on delete cascade,
  emp_name        text,
  gross           numeric(10,2) default 0,
  basic           numeric(10,2) default 0,
  hra             numeric(10,2) default 0,
  transport       numeric(10,2) default 0,
  other_allow     numeric(10,2) default 0,
  pf_deduction    numeric(10,2) default 0,
  tds             numeric(10,2) default 0,
  lop_deduction   numeric(10,2) default 0,
  net             numeric(10,2) default 0,
  days_present    int default 0,
  days_absent     int default 0,
  ot_hours        numeric(5,2) default 0,
  status          text default 'draft', -- draft|paid
  created_at      timestamptz default now(),
  unique(emp_id, month, year)
);

-- ----------------------------------------------------------------
-- APPRAISALS
-- ----------------------------------------------------------------
create table if not exists appraisals (
  id         uuid primary key default gen_random_uuid(),
  emp_id     text references employees(id) on delete cascade,
  year       int default extract(year from now())::int,
  q1         numeric(5,1) default 0,
  q2         numeric(5,1) default 0,
  q3         numeric(5,1) default 0,
  q4         numeric(5,1) default 0,
  kpi        numeric(5,1) default 0,
  feedback   text default '',
  created_at timestamptz default now(),
  unique(emp_id, year)
);

-- ----------------------------------------------------------------
-- LEAVE POLICY (single row)
-- ----------------------------------------------------------------
create table if not exists leave_policy (
  id                   int primary key default 1,
  annual_days          int default 23,
  public_holidays      int default 12,
  carry_forward        int default 0,
  grace_minutes        int default 15,
  late_threshold_mins  int default 45,
  max_late_per_month   int default 3,
  min_hours_full_day   numeric(4,2) default 9,
  min_hours_half_day   numeric(4,2) default 4.5,
  shift_start          text default '09:00',
  shift_end            text default '18:00',
  encashment           boolean default false
);

insert into leave_policy default values on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- HOLIDAYS (2026 from MotionBrains Policy PDF)
-- ----------------------------------------------------------------
create table if not exists holidays (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  date  date not null unique,
  type  text default 'festival'
);

insert into holidays (name, date, type) values
  ('Makar Sankranti',     '2026-01-14', 'festival'),
  ('Holi',                '2026-03-04', 'festival'),
  ('Id-ul-Fitr',          '2026-03-21', 'festival'),
  ('Rama Navami',         '2026-03-26', 'festival'),
  ('Id-ul-Zuha',          '2026-05-27', 'festival'),
  ('Muharram',            '2026-06-26', 'festival'),
  ('Id-e-Milad',          '2026-08-26', 'festival'),
  ('Raksha Bandhan',      '2026-08-28', 'festival'),
  ('Janmashtami',         '2026-09-04', 'festival'),
  ('Diwali',              '2026-11-08', 'festival'),
  ('Govardhan Puja',      '2026-11-09', 'festival'),
  ('Bhai Duj',            '2026-11-10', 'festival')
on conflict (date) do nothing;

-- ----------------------------------------------------------------
-- BIOMETRIC IMPORT LOG
-- ----------------------------------------------------------------
create table if not exists biometric_imports (
  id              uuid primary key default gen_random_uuid(),
  file_name       text,
  total_punches   int default 0,
  records_saved   int default 0,
  unmatched       int default 0,
  imported_at     timestamptz default now()
);

-- ----------------------------------------------------------------
-- DISABLE RLS for simplicity (enable + add policies for production)
-- ----------------------------------------------------------------
alter table employees       disable row level security;
alter table attendance      disable row level security;
alter table leave_requests  disable row level security;
alter table payroll         disable row level security;
alter table appraisals      disable row level security;
alter table leave_policy    disable row level security;
alter table holidays        disable row level security;
alter table biometric_imports disable row level security;
