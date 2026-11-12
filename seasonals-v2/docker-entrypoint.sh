#!/bin/bash
# Boots MariaDB inside the container, prepares the app database, runs
# migrations and starts the app. Used by the Dockerfile demo deploy.
set -e

DATADIR=/var/lib/mysql
SOCKET=/run/mysqld/mysqld.sock
DB_PASSWORD="${DB_PASSWORD:-seasonal-demo-db}"

mkdir -p /run/mysqld "$DATADIR" /var/data/uploads
chown -R mysql:mysql /run/mysqld "$DATADIR" /var/data/uploads

if [ ! -d "$DATADIR/mysql" ]; then
  echo "[entrypoint] Initialising database directory…"
  mariadb-install-db --user=mysql --datadir="$DATADIR" \
    --auth-root-authentication-method=normal >/dev/null
fi

echo "[entrypoint] Starting MariaDB…"
mariadbd --user=mysql --datadir="$DATADIR" --bind-address=127.0.0.1 \
  --port=3306 --socket="$SOCKET" >/var/log/mariadb.log 2>&1 &
for i in $(seq 1 60); do
  if mariadb-admin --socket="$SOCKET" -u root ping >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

mariadb --socket="$SOCKET" -u root <<SQL
CREATE DATABASE IF NOT EXISTS seasonal;
CREATE USER IF NOT EXISTS 'seasonal'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'seasonal'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON seasonal.* TO 'seasonal'@'127.0.0.1';
GRANT ALL PRIVILEGES ON seasonal.* TO 'seasonal'@'localhost';
FLUSH PRIVILEGES;
SQL

export DATABASE_URL="mysql://seasonal:${DB_PASSWORD}@127.0.0.1:3306/seasonal"
export STORAGE_DIR=/var/data/uploads

cd /app
echo "[entrypoint] Running migrations…"
pnpm db:migrate

echo "[entrypoint] Starting Seasonal Solutions on port ${PORT:-10000}…"
exec node dist/index.js
