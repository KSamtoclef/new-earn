begin;

do $$
declare
  mapping record;
  source_oid oid;
  source_args text;
  source_count integer;
  target_count integer;
begin
  for mapping in
    select * from (values
      ('chatearn_v3_admin_is_admin', 'chatearn_admin_is_admin'),
      ('chatearn_v4_get_unique_offer', 'chatearn_get_sponsored_offer'),
      ('chatearn_v3_track_offer_event', 'chatearn_track_sponsored_event'),
      ('chatearn_v6_admin_save_offer', 'chatearn_admin_save_offer'),
      ('chatearn_v6_admin_save_task', 'chatearn_admin_save_task'),
      ('chatearn_v6_admin_queue_impl', 'chatearn_admin_get_queue'),
      ('chatearn_v6_admin_bulk_review_impl', 'chatearn_admin_review_records')
    ) as names(old_name, new_name)
  loop
    select count(*) into source_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = mapping.old_name;

    select count(*) into target_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = mapping.new_name;

    if source_count = 0 and target_count = 1 then
      continue;
    end if;

    if source_count <> 1 then
      raise exception 'Expected exactly one public.% function, found %', mapping.old_name, source_count;
    end if;

    if target_count <> 0 then
      raise exception 'Canonical function public.% already exists while public.% is still present', mapping.new_name, mapping.old_name;
    end if;

    select p.oid, pg_get_function_identity_arguments(p.oid)
      into source_oid, source_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = mapping.old_name;

    execute format(
      'alter function public.%I(%s) rename to %I',
      mapping.old_name,
      source_args,
      mapping.new_name
    );
  end loop;
end
$$;

commit;
