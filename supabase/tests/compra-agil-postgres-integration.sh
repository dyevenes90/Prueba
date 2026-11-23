#!/usr/bin/env bash
set -euo pipefail

psql -X -v ON_ERROR_STOP=1 -f supabase/tests/compra-agil-postgres-integration.sql

# Exercise the granted RPC as the actual service_role, not as the migration owner.
psql -X -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.compra_agil_sync_commit_page('historical',16,'00000000-0000-4000-8000-000000000016',1,2,false,'2026-11-24T00:00:00Z','[]'::jsonb); RESET ROLE;"
psql -X -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF (SELECT next_page FROM public.compra_agil_sync_state WHERE region_id=16) <> 2 THEN RAISE EXCEPTION 'service_role RPC did not advance checkpoint'; END IF; END \$\$;"

# Race two independent PostgreSQL sessions against the same lease and page.
mkdir -p "$RUNNER_TEMP/ca-pg-race"
race_sql="SET ROLE service_role; SELECT public.compra_agil_sync_commit_page('priority',14,'00000000-0000-4000-8000-000000000014',1,2,false,'2026-11-24T00:00:00Z','[{\"codigo\":\"888-1-COT26\",\"nombre\":\"Concurrente\",\"institucion\":{\"region\":14}}]'::jsonb); RESET ROLE;"
psql -X -v ON_ERROR_STOP=1 -c "$race_sql" >"$RUNNER_TEMP/ca-pg-race/a.out" 2>&1 & a=$!
psql -X -v ON_ERROR_STOP=1 -c "$race_sql" >"$RUNNER_TEMP/ca-pg-race/b.out" 2>&1 & b=$!
set +e
wait "$a"; a_status=$?
wait "$b"; b_status=$?
set -e
if ! { [[ $a_status -eq 0 && $b_status -ne 0 ]] || [[ $b_status -eq 0 && $a_status -ne 0 ]]; }; then
  cat "$RUNNER_TEMP/ca-pg-race/a.out" "$RUNNER_TEMP/ca-pg-race/b.out"
  echo "Expected exactly one concurrent writer to commit; statuses: $a_status, $b_status" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF (SELECT count(*) FROM public.compra_agil_oportunidades WHERE codigo='888-1-COT26') <> 1 OR (SELECT next_page FROM public.compra_agil_sync_priority_state WHERE region_id=14) <> 2 THEN RAISE EXCEPTION 'concurrent commit/checkpoint invariant failed'; END IF; END \$\$;"
psql -X -v ON_ERROR_STOP=1 -c "DROP TRIGGER test_delay_concurrent_insert ON public.compra_agil_oportunidades; DROP FUNCTION public.test_delay_concurrent_insert();"
echo "PostgreSQL integration passed: migration idempotency, RLS/ACL, actual service_role RPC, split checkpoints, version safety, rollback, lease expiry, Chile timestamps, and concurrent writers."
