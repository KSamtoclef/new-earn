-- Repair legacy chat functions that still reference the removed
-- public.chatearn_profiles relation. The canonical table is public.profiles.
-- This is intentionally limited to public functions containing that exact
-- legacy relation name; all existing function signatures and grants remain.

do $$
declare
  fn record;
  original_definition text;
  repaired_definition text;
  repaired_count integer := 0;
begin
  for fn in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ilike '%chatearn_profiles%'
  loop
    original_definition := pg_get_functiondef(fn.oid);
    repaired_definition := original_definition;

    repaired_definition := replace(
      repaired_definition,
      '"public"."chatearn_profiles"',
      '"public"."profiles"'
    );
    repaired_definition := replace(
      repaired_definition,
      'public.chatearn_profiles',
      'public.profiles'
    );
    repaired_definition := regexp_replace(
      repaired_definition,
      '\mchatearn_profiles\M',
      'profiles',
      'g'
    );

    if repaired_definition <> original_definition then
      execute repaired_definition;
      repaired_count := repaired_count + 1;
    end if;
  end loop;

  raise notice 'Repaired % function(s) referencing public.chatearn_profiles', repaired_count;
end
$$;

-- Block the migration if any callable public function still contains the
-- obsolete relation name, so a partial repair cannot appear successful.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ilike '%chatearn_profiles%'
  ) then
    raise exception 'Legacy public.chatearn_profiles reference still exists in a public function';
  end if;
end
$$;
