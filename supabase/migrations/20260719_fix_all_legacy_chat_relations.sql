-- Repair legacy public.chatearn_* relation references inside callable public
-- functions/procedures. A replacement is applied only when the matching
-- canonical public table already exists.

create temporary table if not exists _ce_relation_map (
  legacy_name text primary key,
  canonical_name text not null
) on commit drop;

truncate table _ce_relation_map;

insert into _ce_relation_map (legacy_name, canonical_name) values
  ('chatearn_profiles', 'profiles'),
  ('chatearn_withdrawals', 'withdrawals'),
  ('chatearn_kyc_submissions', 'kyc_submissions'),
  ('chatearn_chat_threads', 'chat_threads'),
  ('chatearn_chat_messages', 'chat_messages'),
  ('chatearn_wallet_ledger', 'wallet_ledger'),
  ('chatearn_payout_accounts', 'payout_accounts'),
  ('chatearn_offer_events', 'offer_events'),
  ('chatearn_offers', 'offers'),
  ('chatearn_tasks', 'tasks')
on conflict (legacy_name) do update
set canonical_name = excluded.canonical_name;

do $$
declare
  fn record;
  mapping record;
  original_definition text;
  repaired_definition text;
  repaired_count integer := 0;
begin
  for fn in
    with candidates as materialized (
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind in ('f', 'p')
    )
    select c.oid
    from candidates c
    where pg_get_functiondef(c.oid) ilike '%chatearn_%'
  loop
    original_definition := pg_get_functiondef(fn.oid);
    repaired_definition := original_definition;

    for mapping in
      select legacy_name, canonical_name
      from _ce_relation_map
      where to_regclass(format('public.%I', canonical_name)) is not null
    loop
      repaired_definition := replace(
        repaired_definition,
        format('"public"."%s"', mapping.legacy_name),
        format('"public"."%s"', mapping.canonical_name)
      );

      repaired_definition := replace(
        repaired_definition,
        format('public.%s', mapping.legacy_name),
        format('public.%s', mapping.canonical_name)
      );

      repaired_definition := regexp_replace(
        repaired_definition,
        format('\\m%s\\M', mapping.legacy_name),
        mapping.canonical_name,
        'g'
      );
    end loop;

    if repaired_definition <> original_definition then
      execute repaired_definition;
      repaired_count := repaired_count + 1;
    end if;
  end loop;

  raise notice 'Repaired % callable public function(s)/procedure(s)', repaired_count;
end
$$;

-- Fail only when a mapped legacy relation still remains while its canonical
-- replacement table exists.
do $$
declare
  remaining text;
begin
  with candidates as materialized (
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
  ), unresolved as (
    select distinct m.legacy_name
    from candidates c
    cross join _ce_relation_map m
    where to_regclass(format('public.%I', m.canonical_name)) is not null
      and pg_get_functiondef(c.oid) ilike '%' || m.legacy_name || '%'
  )
  select string_agg(legacy_name, ', ' order by legacy_name)
  into remaining
  from unresolved;

  if remaining is not null then
    raise exception 'Legacy relation reference(s) still remain: %', remaining;
  end if;
end
$$;
