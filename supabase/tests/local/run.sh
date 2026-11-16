#!/usr/bin/env bash
# Run the security SQL tests against a fresh local database.
#
#   PGHOST=<socket dir> PGPORT=<port> PGUSER=postgres supabase/tests/local/run.sh <migration.sql ...> -- <test.sql ...>
#
# Makes a throwaway database, loads bootstrap.sql, applies each migration TWICE (they must be safe to run twice),
# then runs each test. Never point this at the live project.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="sec_test_$$"

migrations=()
tests=()
seen_sep=0
for arg in "$@"; do
  if [[ "$arg" == "--" ]]; then seen_sep=1; continue; fi
  if [[ $seen_sep -eq 0 ]]; then migrations+=("$arg"); else tests+=("$arg"); fi
done

createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
psql -q -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/bootstrap.sql" >/dev/null

for m in "${migrations[@]}"; do
  for pass in 1 2; do
    echo "== apply $m (pass $pass)"
    if ! out="$(psql -q -X -v ON_ERROR_STOP=1 -d "$db" -f "$m" 2>&1)"; then
      echo "$out"; echo "FAIL: $m did not apply on pass $pass"; exit 1
    fi
    [[ -n "$out" ]] && echo "$out"
  done
done

status=0
for t in "${tests[@]}"; do
  echo "== test $t"
  if ! psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$t" 2>&1 | sed -E 's/^psql:[^ ]+ NOTICE:  //'; then status=1; fi
  [[ ${PIPESTATUS[0]} -eq 0 ]] || status=1
done
exit $status
