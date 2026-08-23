-- Enforce the product rule that recurring availability starts and ends on full hours.
alter table public.availabilities
  add constraint availabilities_full_hour_times_ck
  check (
    extract(minute from start_time) = 0
    and extract(second from start_time) = 0
    and extract(minute from end_time) = 0
    and extract(second from end_time) = 0
  );
