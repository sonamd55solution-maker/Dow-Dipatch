-- ============================================================
-- Department of Water — Dispatch Booking System
-- Seed Data — Run AFTER schema.sql
-- ============================================================

-- Sample Divisions
insert into public.divisions (name, is_active) values
  ('Water Resource Division', true),
  ('Engineering Division', true),
  ('Planning and Policy Division', true),
  ('Finance and Administration Division', true),
  ('Research and Development Division', true)
on conflict do nothing;

-- Sample File Indexes
insert into public.file_indexes (code, description, is_active) values
  ('11', 'General Administration', true),
  ('12', 'Projects and Construction', true),
  ('13', 'Human Resources', true),
  ('14', 'Procurement', true),
  ('15', 'Finance and Budget', true),
  ('16', 'Research and Studies', true),
  ('17', 'Legal and Compliance', true)
on conflict (code) do nothing;

-- ============================================================
-- AFTER RUNNING THIS SEED:
--
-- 1. Register your admin account via login.html
-- 2. Run this in SQL Editor to promote yourself to admin:
--
--    update public.profiles
--      set role = 'admin'
--      where email = 'your-email@dow.gov.bt';
--
-- 3. Log out and log back in.
--    The Admin Panel link will appear in the sidebar.
-- ============================================================
