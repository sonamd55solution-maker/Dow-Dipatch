-- ============================================================
-- Department of Water — Dispatch Booking System
-- Supabase Schema
-- Run this FIRST in SQL Editor before seed.sql
-- ============================================================

-- ---- Extensions ----
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES — one row per auth.users entry
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        text not null default 'staff' check (role in ('staff','admin')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. DIVISIONS
-- ============================================================
create table if not exists public.divisions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. FILE INDEXES
-- ============================================================
create table if not exists public.file_indexes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  description text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 4. DISPATCH COUNTERS — one row per financial year
--    Locked during booking to guarantee atomicity
-- ============================================================
create table if not exists public.dispatch_counters (
  financial_year text primary key,
  last_number    integer not null default 0
);

-- ============================================================
-- 5. BOOKINGS
-- ============================================================
create table if not exists public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  dispatch_number      integer not null,
  financial_year       text not null,
  file_index_id        uuid not null references public.file_indexes(id),
  file_index_code      text not null,
  division_id          uuid not null references public.divisions(id),
  division_name        text not null,
  full_dispatch_number text not null unique,
  subject              text not null,
  recipient            text not null,
  requested_by         text not null,
  booked_by            uuid not null references auth.users(id),
  booked_by_name       text not null default '',
  status               text not null default 'Reserved'
                         check (status in ('Reserved','Approved','Used','Expired','Cancelled')),
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null default (now() + interval '7 days'),
  updated_at           timestamptz not null default now()
);

create index if not exists bookings_booked_by_idx    on public.bookings(booked_by);
create index if not exists bookings_status_idx       on public.bookings(status);
create index if not exists bookings_financial_year_idx on public.bookings(financial_year);

-- ============================================================
-- 6. HELPER: get current financial year
-- ============================================================
create or replace function public.get_financial_year(ts timestamptz default now())
returns text language sql immutable as $$
  select case
    when extract(month from ts) >= 7
      then extract(year from ts)::text || '-' || (extract(year from ts)+1)::text
    else (extract(year from ts)-1)::text || '-' || extract(year from ts)::text
  end;
$$;

-- ============================================================
-- 7. CORE FUNCTION: book_dispatch
--    Called by client via supabaseClient.rpc('book_dispatch', {...})
--    Returns the full booking row so the client can display the number.
-- ============================================================
create or replace function public.book_dispatch(
  p_division_id    uuid,
  p_file_index_id  uuid,
  p_subject        text,
  p_recipient      text,
  p_requested_by   text
)
returns table (
  id                   uuid,
  full_dispatch_number text,
  dispatch_number      integer,
  financial_year       text,
  expires_at           timestamptz
)
language plpgsql security definer as $$
declare
  v_fy          text;
  v_counter     integer;
  v_div_name    text;
  v_fi_code     text;
  v_full_number text;
  v_user_id     uuid := auth.uid();
  v_user_name   text;
  v_booking_id  uuid;
begin
  -- Must be logged in
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve names from IDs (also validates they are active)
  select name into v_div_name from public.divisions
    where id = p_division_id and is_active = true;
  if not found then
    raise exception 'Invalid or inactive division selected';
  end if;

  select code into v_fi_code from public.file_indexes
    where id = p_file_index_id and is_active = true;
  if not found then
    raise exception 'Invalid or inactive file index selected';
  end if;

  -- Get caller's full name
  select full_name into v_user_name from public.profiles where id = v_user_id;

  -- Current financial year
  v_fy := public.get_financial_year();

  -- Atomically increment counter (row-level lock prevents duplicates)
  insert into public.dispatch_counters (financial_year, last_number)
    values (v_fy, 1)
    on conflict (financial_year) do update
      set last_number = dispatch_counters.last_number + 1
    returning last_number into v_counter;

  -- Build formatted dispatch number: MoENR/DoW/{code}/{FY}/{0001}
  v_full_number := 'MoENR/DoW/' || v_fi_code || '/' || v_fy || '/' || lpad(v_counter::text, 4, '0');

  -- Insert booking
  insert into public.bookings (
    dispatch_number, financial_year, file_index_id, file_index_code,
    division_id, division_name, full_dispatch_number,
    subject, recipient, requested_by, booked_by, booked_by_name,
    status, expires_at
  ) values (
    v_counter, v_fy, p_file_index_id, v_fi_code,
    p_division_id, v_div_name, v_full_number,
    p_subject, p_recipient, p_requested_by, v_user_id, coalesce(v_user_name,''),
    'Reserved', now() + interval '7 days'
  ) returning bookings.id into v_booking_id;

  return query
    select b.id, b.full_dispatch_number, b.dispatch_number, b.financial_year, b.expires_at
    from public.bookings b where b.id = v_booking_id;
end;
$$;

-- ============================================================
-- 8. EXPIRY FUNCTION — call on page load, no cron needed
-- ============================================================
create or replace function public.expire_overdue_bookings()
returns void language plpgsql security definer as $$
begin
  update public.bookings
    set status = 'Expired', updated_at = now()
    where status = 'Reserved'
      and expires_at < now();
end;
$$;

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles    enable row level security;
alter table public.divisions   enable row level security;
alter table public.file_indexes enable row level security;
alter table public.bookings    enable row level security;
alter table public.dispatch_counters enable row level security;

-- Drop existing policies (idempotent re-run)
drop policy if exists "profiles_own_read"    on public.profiles;
drop policy if exists "profiles_admin_all"   on public.profiles;
drop policy if exists "divisions_read"       on public.divisions;
drop policy if exists "divisions_admin_write" on public.divisions;
drop policy if exists "fileindexes_read"     on public.file_indexes;
drop policy if exists "fileindexes_admin_write" on public.file_indexes;
drop policy if exists "bookings_own_read"    on public.bookings;
drop policy if exists "bookings_admin_read"  on public.bookings;
drop policy if exists "bookings_admin_write" on public.bookings;
drop policy if exists "bookings_insert_self" on public.bookings;
drop policy if exists "counters_no_direct"   on public.dispatch_counters;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- PROFILES
create policy "profiles_own_read" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());

-- DIVISIONS — everyone authenticated can read active rows; only admins write
create policy "divisions_read" on public.divisions
  for select using (auth.uid() is not null);

create policy "divisions_admin_write" on public.divisions
  for all using (public.is_admin());

-- FILE INDEXES
create policy "fileindexes_read" on public.file_indexes
  for select using (auth.uid() is not null);

create policy "fileindexes_admin_write" on public.file_indexes
  for all using (public.is_admin());

-- BOOKINGS — staff see own rows; admins see all
create policy "bookings_own_read" on public.bookings
  for select using (booked_by = auth.uid());

create policy "bookings_admin_read" on public.bookings
  for select using (public.is_admin());

-- Staff insert via RPC only (book_dispatch is security definer, bypasses RLS)
-- No direct insert policy needed for staff.

-- Admin can update status, division, subject, recipient, requested_by
create policy "bookings_admin_write" on public.bookings
  for update using (public.is_admin());

-- COUNTERS — never accessible directly
create policy "counters_no_direct" on public.dispatch_counters
  for all using (false);

-- ============================================================
-- DONE — run seed.sql next
-- ============================================================
