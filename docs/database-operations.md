# Database Operations

Nexodoc uses Prisma migrations as the source of truth for database structure.
Production deploys must run `npm run db:migrate`; `npm run db:push` is only for
local development or emergency schema synchronization.

## Backup

Run a backup before every production migration:

```bash
npm run db:backup
```

The script requires `DATABASE_URL` and `pg_dump` in the runtime PATH. It writes
custom-format dumps into `NEXODOC_BACKUP_DIR` or `./backups`.

## Restore

Restores are intentionally gated:

```bash
BACKUP_FILE=./backups/nexodoc-example.dump NEXODOC_ALLOW_DB_RESTORE=true npm run db:restore
```

The script requires `pg_restore` and will clean existing objects before
restoring the selected dump.

## Storage

File records now store provider, key, URL, size and SHA-256 checksum. By default:

```bash
NEXODOC_STORAGE_PROVIDER=none
```

This records metadata only. When an external provider is added, set
`NEXODOC_STORAGE_PROVIDER` and `NEXODOC_STORAGE_BASE_URL` so artifacts keep a
stable lookup key without changing the project schema.

## Secrets

Run:

```bash
npm run db:check-env
```

If a database URL ever appears in a tracked file, rotate the credential in Neon
and update the deployment environment variables.
