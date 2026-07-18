-- Restore authenticated access to every public.chatearn_send_message overload.
-- This fixes: permission denied for function chatearn_send_message

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'chatearn_send_message'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END
$$;

-- Verification query:
-- select p.oid::regprocedure as function_signature,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname='public' and p.proname='chatearn_send_message';
