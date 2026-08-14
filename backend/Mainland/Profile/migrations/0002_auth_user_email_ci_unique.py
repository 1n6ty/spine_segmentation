from django.db import connection, migrations

# DB-only constraint -- deliberately no state_operations. auth.User isn't a
# model this app owns/manages, so there is no Django model field to reflect
# this in ORM state; it only needs to exist as a raw index in the database.
# NULLIF(UPPER(email), '') rather than plain UPPER(email) -- a unique index
# never conflicts on NULL (both MySQL and SQLite), so every blank-email User
# (many exist across the test suite, e.g. Company/v1/tests/base.py's
# create_company_user) stays exempt from the constraint without needing a
# partial/filtered index, which MySQL doesn't support. MySQL's functional key
# parts require an extra pair of parens around the expression to distinguish
# it from a column key part; SQLite does not.
#
# RunSQL, not RunPython + schema_editor.execute(): RunPython wraps its
# callable in its own atomic savepoint, nested inside the migration's own
# atomic block -- MySQL/InnoDB can't roll back DDL inside a transaction, so
# that combination raises TransactionManagementError there (SQLite tolerates
# it, which is why this only ever surfaced against a real, freshly-migrated
# MySQL database, never the mocked SQLite tier or an already-migrated dev
# volume). RunSQL executes directly against the schema editor with no extra
# atomic wrapping, so it doesn't hit this. The vendor branch has to happen at
# migration-load time instead of inside a callable, since RunSQL takes a
# literal SQL string, not a per-vendor callable.
_INDEX_NAME = 'auth_user_email_ci_unique'

if connection.vendor == 'sqlite':
    _CREATE_SQL = f"CREATE UNIQUE INDEX {_INDEX_NAME} ON auth_user (NULLIF(UPPER(email), ''))"
    _DROP_SQL = f"DROP INDEX {_INDEX_NAME}"
elif connection.vendor == 'mysql':
    _CREATE_SQL = f"CREATE UNIQUE INDEX {_INDEX_NAME} ON auth_user ((NULLIF(UPPER(email), '')))"
    _DROP_SQL = f"DROP INDEX {_INDEX_NAME} ON auth_user"
else:
    raise NotImplementedError(f"Unsupported DB vendor for email CI-uniqueness: {connection.vendor}")


class Migration(migrations.Migration):

    dependencies = [
        ('Profile', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunSQL(sql=_CREATE_SQL, reverse_sql=_DROP_SQL),
    ]
