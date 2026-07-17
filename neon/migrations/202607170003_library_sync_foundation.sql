-- A durable marker prevents a partially completed first import from being
-- mistaken for a fully initialized cloud library after a refresh.

alter table public.profiles
add column library_initialized_at timestamptz;
