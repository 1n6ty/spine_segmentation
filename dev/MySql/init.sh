#!/bin/bash
set -e

mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL

CREATE DATABASE IF NOT EXISTS \`spine_segmentation_db\` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'spine_segmentation_user'@'%' 
  IDENTIFIED BY '${DB_PASSWORD}';

GRANT ALL PRIVILEGES ON \`spine_segmentation_db\`.* TO 'spine_segmentation_user'@'%';

CREATE DATABASE IF NOT EXISTS \`spine_segmentation_logs_db\` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON \`spine_segmentation_logs_db\`.* TO 'spine_segmentation_user'@'%';

-- Django's test runner creates/drops a throwaway \`test_<db>\` database per
-- alias (test_db, test_logs, plus test_db_N under --parallel) for every
-- \`manage.py test\` run against real MySQL (DJANGO_ENV=test_docker) -- grant
-- covers that whole naming family so the app user doesn't need superuser.
GRANT ALL PRIVILEGES ON \`test\_%\`.* TO 'spine_segmentation_user'@'%';

CREATE USER IF NOT EXISTS 'proxysql_monitor'@'%' IDENTIFIED BY 'proxysql_monitor';
GRANT USAGE, REPLICATION CLIENT ON *.* TO 'proxysql_monitor'@'%';

FLUSH PRIVILEGES;

EOSQL
