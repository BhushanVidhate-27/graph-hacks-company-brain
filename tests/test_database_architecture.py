import os
import tempfile
from collections import deque


def _isolated_db():
    tmp = tempfile.TemporaryDirectory()
    path = os.path.join(tmp.name, "helio-test.db")
    old_path = os.environ.get("HELIO_DB_PATH")
    old_url = os.environ.get("DATABASE_URL")
    os.environ["HELIO_DB_PATH"] = path
    os.environ.pop("DATABASE_URL", None)

    import app.db as db

    db._SCHEMA_READY.clear()
    yield db, path
    db._SCHEMA_READY.clear()
    if old_path is None:
        os.environ.pop("HELIO_DB_PATH", None)
    else:
        os.environ["HELIO_DB_PATH"] = old_path
    if old_url is not None:
        os.environ["DATABASE_URL"] = old_url
    tmp.cleanup()


def test_schema_migration_is_additive_and_preserves_existing_rows():
    for db, path in _isolated_db():
        from app import store

        created = store.create_account_with_owner(
            account_name="Architecture",
            email="arch@example.test",
            name="Arch",
            password_hash="hash",
        )
        account_id = created["account"]["id"]

        with db.connect() as conn:
            tables = {
                row["name"]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            expected = {
                "accounts",
                "users",
                "subscriptions",
                "workspaces",
                "knowledge_documents",
                "document_chunks",
                "claims",
                "evidence_links",
                "approvals",
                "decisions",
                "ingestion_jobs",
                "graph_sync_outbox",
            }
            assert expected.issubset(tables)
            legacy_accounts = conn.execute("SELECT COUNT(*) AS n FROM accounts").fetchone()["n"]
            legacy_users = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
            workspaces = conn.execute(
                "SELECT COUNT(*) AS n FROM workspaces WHERE tenant_id = ? AND account_id = ?",
                (account_id, account_id),
            ).fetchone()["n"]
        assert legacy_accounts >= 1
        assert legacy_users >= 1
        assert workspaces == 1


def test_workspace_graph_naming_isolated_by_workspace():
    for db, path in _isolated_db():
        from app import graph

        assert graph.graph_name_for("acct_abc", "workspace_1") != graph.graph_name_for("acct_abc", "workspace_2")
        token = graph.set_current_workspace("workspace_1")
        try:
            assert graph.graph_name_for("acct_abc") == "helio_workspace_1"
        finally:
            graph.reset_current_workspace(token)


def test_pipeline_persists_document_chunks_claims_outbox_and_retrieval():
    for db, path in _isolated_db():
        from app import pipeline, retrieval, store

        created = store.create_account_with_owner(
            account_name="Pipeline",
            email="pipeline@example.test",
            name="Pipe",
            password_hash="hash",
        )
        account_id = created["account"]["id"]

        result = pipeline.persist_document(
            account_id,
            workspace_id=account_id,
            title="Ownership doc",
            chunks=["Ravi Menon owns payments-gateway and Platform supports payments."],
            provenance={"source": "test"},
            source_kind="upload",
        )
        assert result["chunk_count"] == 1

        with db.tenant_context(account_id, account_id):
            with db.connect() as conn:
                docs = conn.execute("SELECT COUNT(*) AS n FROM knowledge_documents WHERE tenant_id = ?", (account_id,)).fetchone()["n"]
                chunks = conn.execute("SELECT COUNT(*) AS n FROM document_chunks WHERE tenant_id = ?", (account_id,)).fetchone()["n"]
                claims = conn.execute("SELECT COUNT(*) AS n FROM claims WHERE tenant_id = ?", (account_id,)).fetchone()["n"]
                outbox = conn.execute("SELECT COUNT(*) AS n FROM graph_sync_outbox WHERE tenant_id = ?", (account_id,)).fetchone()["n"]
        assert docs == 1
        assert chunks == 1
        assert claims >= 1
        assert outbox >= 1

        found = retrieval.hybrid_search(account_id, "who owns payments-gateway", workspace_id=account_id)
        assert found["results"]
        assert found["results"][0]["chunk_id"]
        assert found["results"][0]["citation"]


def test_graph_writer_preserves_source_provenance_on_nodes_and_relationships():
    queries: list[tuple[str, dict]] = []

    class FakeGraph:
        def query(self, cypher, params):
            queries.append((cypher, params))
            class Result:
                result_set = [["ok"]]

            return Result()

    from app import graph_writer

    entity = graph_writer.upsert_entity(
        FakeGraph(),
        label="Person",
        properties={"name": "Ravi Menon"},
        tenant_id="acct_test",
        workspace_id="workspace_test",
        source_document_id="doc_1",
        source_url="s3://bucket/doc_1",
        provenance="hash123",
    )
    relationship = graph_writer.upsert_relationship(
        FakeGraph(),
        from_label="Person",
        from_key="Ravi Menon",
        relationship="CREATED",
        to_label="Project",
        to_key="payments-gateway",
        tenant_id="acct_test",
        workspace_id="workspace_test",
        source_document_id="doc_1",
        source_url="s3://bucket/doc_1",
        provenance="hash123",
    )

    assert entity["label"] == "Person"
    assert relationship["relationship"] == "CREATED"
    combined = "\n".join(q[0] for q in queries)
    payload_keys = "\n".join(", ".join(sorted(params.get("props", {}).keys())) for _, params in queries)
    assert "source_document_id" in payload_keys
    assert "source_url" in payload_keys
    assert "provenance_hash" in payload_keys
    assert "tenant_id" in payload_keys
    assert "workspace_id" in payload_keys
    assert "SET n +=" in combined
    assert "SET r +=" in combined


def test_database_architecture_docs_and_compose_document_persistence_and_cognee_boundary():
    compose = open("deploy/docker-compose.yml").read()
    docs = open("docs/database-architecture.md").read()

    assert "pgvector/pgvector:pg16" in compose
    assert "--appendonly" in compose
    assert "helio-falkordb" in compose
    assert "helio-objects" in compose
    assert "Cognee was **not** adopted as the canonical knowledge owner" in docs
    assert "Production database configuration is **not verified" in docs
    assert "pg_dump" in docs
    assert "rebuild" in docs.lower()
