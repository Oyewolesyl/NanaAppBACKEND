-- allow the app's "0 - none" pain score to be saved in production.
alter table public.pain_logs
  drop constraint if exists pain_logs_pain_scale_check;

alter table public.pain_logs
  add constraint pain_logs_pain_scale_check
  check (pain_scale between 0 and 10);
