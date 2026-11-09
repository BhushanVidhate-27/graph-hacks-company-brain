# Helio — Database Architecture

## Current implementation map

Helio uses **PostgreSQL as the production source of truth** and SQLite as the
local development fallback. FalkorDB is a rebuildable projection of the
canonical knowledge records, not the source of truth.

- **Postgres:** accounts, users, sessions, API keys, subscriptions, usage,
  integrations, import runs, facts, proposals, approvals, decisions, canonical
  documents, chunks, claims, evidence links, ingestion jobs and the graph sync
  outbox. `pgvector` stores chunk embeddings for semantic retrieval.
- **SQLite fallback:** the same app state and knowledge tables, with embeddings
  stored as JSON text. This keeps the local developer workflow single-process.
- **FalkorDB:** one named graph per workspace (`helio_<workspace_id>`). Tenant
  and workspace access is derived from the authenticated account's default
  workspace server-side.
- **Original files:** stored in object storage
  (`HELIO_OBJECT_STORAGE_DIR` locally, optional S3 via boto3 with
  `HELIO_OBJECT_STORAGE_S3_BUCKET`). Postgres stores the URI and provenance.
- **Retrieval:** hybrid Postgres selection (vector similarity via pgvector,
  lexical matching) then reranking. Every result carries source citations and
  provenance metadata. Graph traversal remains in `app/graph.py` and remains
  the agent's evidence trail.

## Tenant and workspace isolation

Each account maps to a default workspace (`workspace_id == account_id`).
Knowledge records carry both `tenant_id` and `workspace_id`, and Postgres row
level security policies on workspace/knowledge tables are enforced using the
`app.current_tenant` and `app.current_workspace` session settings set from
server-side authenticated context.

FalkorDB graph writes always select the current workspace's graph by
`graph_service.graph_name_for(tenant_id, workspace_id)`. Knowledge store
functions set tenant/workspace context before opening Postgres connections.

## Ingestion pipeline

`app/pipeline.py` implements the canonical ingestion stages:

1. source ingestion
2. parsing
3. chunking
4. embedding generation
5. entity and relationship extraction
6. deduplication
7. conflict detection
8. human review
9. Postgres persistence
10. FalkorDB graph updates

Each document/chunk/claim write also creates a transactional outbox row in
`graph_sync_outbox`. `app/graph_sync.py` replays pending rows into FalkorDB
with bounded retries and marks events processed only after the graph write
succeeds.

Canonical persistence is used by:

- document upload (`app/knowledge.py`)
- integration imports (`app/integrations.py`)

## Cognee evaluation

Cognee was **not** adopted as the canonical knowledge owner. Helio keeps its
own accounts, billing, authorization, canonical documents/claims/decisions
and outbox. Cognee may remain an optional extractor/retriever behind the
pipeline, but must not own Helio's tenancy, billing or source-of-truth data.

Before any production Cognee integration, validate:

- the exact Cognee FalkorDB adapter available in the pinned Cognee version,
- whether it writes to the same graph namespace per workspace,
- whether dataset/workspace permissions match Helio tenant/workspace IDs,
- whether its vector indexes can be rebuilt from Postgres canonical records.

## Backups and recovery

### Postgres

Back up the Postgres database before every destructive operation:

```bash
pg_dump "$DATABASE_URL" -Fc -f helio.pgcustom
```

Restore:

```bash
pg_restore -d "$DATABASE_URL" helio.pgcustom
```

Run migrations on startup or explicitly through the app's idempotent schema
application. Alembic-style versioning is not used yet; migrations are the
idempotent `CREATE TABLE IF NOT EXISTS` and backfill statements in `app/db.py`.

### SQLite fallback

Copy `data/helio.db` (with `-wal` and `-shm`) before maintenance. Restore by
copying the file back into the configured `HELIO_DB_PATH`.

### FalkorDB recovery

FalkorDB is rebuildable from Postgres:

1. Stop the graph sync worker.
2. Restore the Postgres backup.
3. Recreate the workspace graph or delete it when appropriate.
4. Reset pending/failed outbox rows to `pending` for the affected tenant.
5. Restart the graph sync worker (`python -m app.graph_sync --watch`).

The deployment Compose configuration persists FalkorDB with
`--save 900 1 --appendonly yes --dir /data` and a named volume
`helio-falkordb`.

### Object storage

Object storage is copy-on-write by content hash. Restore by restoring both
the object storage contents and the Postgres metadata. Re-upload only the
missing object keys; manifest URIs in `knowledge_documents.object_uri` and
chunk citations should be used to identify missing objects.

## Current verification status

The following are verified in local tests:

- Schema migration creates canonical knowledge and security control tables.
- Tenant/workspace graph naming remains isolated.
- Graph writer includes source provenance on nodes and relationships.
- Hybrid retrieval returns cited chunks.

Production database configuration is **not verified from this repository**
until `DATABASE_URL`, FalkorDB Cloud credentials, and pgvector extension are
explicitly inspected in the target environment.
