-- Repair legacy withdrawal status literals inside callable public functions.
-- Existing withdrawal rows are not modified.

do $$
declare
  fn record;
  original_definition text;
  repaired_definition text;
  repaired_count integer := 0;
  has_pending boolean;
  has_submitted boolean;
  has_completed boolean;
  has_paid boolean;
  has_rejected boolean;
  has_cancelled boolean;
begin
  select exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typname='withdrawal_status' and e.enumlabel='pending'
  ) into has_pending;
  select exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typname='withdrawal_status' and e.enumlabel='submitted'
  ) into has_submitted;
  select exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typname='withdrawal_status' and e.enumlabel='completed'
  ) into has_completed;
  select exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typname='withdrawal_status' and e.enumlabel='paid'
  ) into has_paid;
  select exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typname='withdrawal_status' and e.enumlabel='rejected'
  ) into has_rejected;
  select exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typname='withdrawal_status' and e.enumlabel='cancelled'
  ) into has_cancelled;

  for fn in
    with candidates as materialized (
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.prokind in ('f','p')
    )
    select c.oid
    from candidates c
    where pg_get_functiondef(c.oid) ilike '%withdrawal_status%'
       or pg_get_functiondef(c.oid) ilike '%withdrawal%'
  loop
    original_definition := pg_get_functiondef(fn.oid);
    repaired_definition := original_definition;

    if not has_pending and has_submitted then
      repaired_definition := replace(repaired_definition, '''pending''::withdrawal_status', '''submitted''::withdrawal_status');
      repaired_definition := replace(repaired_definition, '''pending''::public.withdrawal_status', '''submitted''::public.withdrawal_status');
      repaired_definition := regexp_replace(repaired_definition, '''pending''', '''submitted''', 'g');
    end if;

    if not has_completed and has_paid then
      repaired_definition := replace(repaired_definition, '''completed''::withdrawal_status', '''paid''::withdrawal_status');
      repaired_definition := replace(repaired_definition, '''completed''::public.withdrawal_status', '''paid''::public.withdrawal_status');
    end if;

    if not has_rejected and has_cancelled then
      repaired_definition := replace(repaired_definition, '''rejected''::withdrawal_status', '''cancelled''::withdrawal_status');
      repaired_definition := replace(repaired_definition, '''rejected''::public.withdrawal_status', '''cancelled''::public.withdrawal_status');
    end if;

    if repaired_definition <> original_definition then
      execute repaired_definition;
      repaired_count := repaired_count + 1;
    end if;
  end loop;

  raise notice 'Repaired % public function(s) with legacy withdrawal status values', repaired_count;
end
$$;

-- Verify that callable public functions no longer cast unavailable legacy values.
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typname='withdrawal_status' and e.enumlabel='pending'
  ) and exists (
    with candidates as materialized (
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in ('f','p')
    )
    select 1 from candidates c
    where pg_get_functiondef(c.oid) ~ '''pending''::(public\.)?withdrawal_status'
  ) then
    raise exception 'A public function still casts pending to withdrawal_status';
  end if;
end
$$;