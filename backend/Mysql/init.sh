#!/bin/bash
echo "Initializing MySQL database..."

mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "
    CREATE DATABASE ${MYSQL_DB_NAME}
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
    CREATE USER '${MYSQL_DB_USER}'@'%' IDENTIFIED BY '${MYSQL_DB_PASSWORD}';
    GRANT ALL PRIVILEGES ON ${MYSQL_DB_NAME}.* TO '${MYSQL_DB_USER}'@'%';

    FLUSH PRIVILEGES;
"

echo "MySQL database initialization complete."
