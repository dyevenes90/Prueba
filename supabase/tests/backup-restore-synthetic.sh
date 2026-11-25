#!/usr/bin/env bash
set -euo pipefail

dump_file="${RUNNER_TEMP:-/tmp}/cresce-synthetic-public.dump"
restore_db="cresce_restore_synthetic"
cleanup() {
  dropdb --if-exists "$restore_db" >/dev/null 2>&1 || true
  psql -X -v ON_ERROR_STOP=1 -c 'DROP TABLE IF EXISTS public.backup_restore_synthetic' >/dev/null 2>&1 || true
  rm -f "$dump_file"
}
trap cleanup EXIT

psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.backup_restore_synthetic (
  id integer PRIMARY KEY,
  payload text NOT NULL
);
INSERT INTO public.backup_restore_synthetic VALUES
  (1, 'synthetic-alpha'), (2, 'synthetic-beta'), (3, 'synthetic-gamma');
SQL

pg_dump --format=custom --schema=public --table=public.backup_restore_synthetic \
  --no-owner --no-privileges --file "$dump_file"
test -s "$dump_file"
pg_restore --list "$dump_file" >/dev/null
createdb "$restore_db"
pg_restore --exit-on-error --no-owner --no-privileges --dbname "$restore_db" "$dump_file"
actual=$(psql -X -d "$restore_db" -Atc "SELECT count(*) || ':' || string_agg(payload, ',' ORDER BY id) FROM public.backup_restore_synthetic")
if [[ "$actual" != '3:synthetic-alpha,synthetic-beta,synthetic-gamma' ]]; then
  echo "Synthetic restore mismatch: $actual" >&2
  exit 1
fi
sha=$(sha256sum "$dump_file" | awk '{print $1}')
echo "Synthetic public dump/restore passed; rows=3; SHA-256=$sha"
