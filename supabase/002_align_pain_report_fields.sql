-- Aligns production Supabase with the current Nana app flow.
-- The app stores child-friendly start answers such as after-play and dont-know,
-- and uses the expanded pain-type set shown in the report flow.

alter table public.pain_logs
  alter column when_did_it_start type text using when_did_it_start::text;

alter table public.pain_logs
  drop constraint if exists pain_logs_pain_type_check;

alter table public.pain_logs
  add constraint pain_logs_pain_type_check
  check (
    pain_type in (
      'sharp',
      'burning',
      'throbbing',
      'tingling',
      'stabbing',
      'cramping',
      'aching',
      'other',
      'dull'
    )
  );
