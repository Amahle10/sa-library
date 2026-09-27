#!/usr/bin/env bash
# Optional Ubuntu fallback when Docker is unavailable. Does not install system packages.
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_LOCAL="$PROJECT_ROOT/.local/postgres"
PG_BIN="$PG_LOCAL/runtime/usr/lib/postgresql/18/bin"
export LD_LIBRARY_PATH="$PG_LOCAL/runtime/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
mkdir -p "$PG_LOCAL"
if [[ "${1:-start}" == stop ]]; then
  "$PG_BIN/pg_ctl" -D "$PG_LOCAL/data" stop
  exit 0
fi
if [[ ! -x "$PG_BIN/postgres" ]]; then
  (cd "$PG_LOCAL" && apt-get download postgresql-18 postgresql-client-18 libpq5)
  for package in "$PG_LOCAL"/*.deb; do dpkg-deb -x "$package" "$PG_LOCAL/runtime"; done
fi
if [[ ! -f "$PG_LOCAL/data/PG_VERSION" ]]; then
  # This isolated, loopback-only development cluster uses local trust authentication.
  "$PG_BIN/initdb" -D "$PG_LOCAL/data" -U sa_library --auth=trust --no-locale -E UTF8
fi
if ! "$PG_BIN/pg_ctl" -D "$PG_LOCAL/data" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$PG_LOCAL/data" -l "$PG_LOCAL/server.log" -o "-p 55432 -h 127.0.0.1 -k /tmp" start
fi
for database in sa_library sa_library_test; do
  if ! "$PG_BIN/psql" -h 127.0.0.1 -p 55432 -U sa_library -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$database'" | grep -q 1; then
    "$PG_BIN/createdb" -h 127.0.0.1 -p 55432 -U sa_library "$database"
  fi
done
printf 'Local PostgreSQL ready at 127.0.0.1:55432 (user sa_library, databases sa_library and sa_library_test).\n'
