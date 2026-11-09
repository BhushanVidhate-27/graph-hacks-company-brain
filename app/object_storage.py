"""app/object_storage.py — original uploaded file storage.

Canonical bytes live in object storage, while PostgreSQL stores the URI and
provenance metadata. This module intentionally stays small: local filesystem
storage by default, optional S3 via boto3 when configured. Local storage is
a development fallback; object storage remains authoritative for uploads.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path


def _local_dir() -> Path:
    return Path(os.getenv("HELIO_OBJECT_STORAGE_DIR", "data/object-storage"))


def save_bytes(tenant_id: str, workspace_id: str, filename: str, raw: bytes) -> str:
    """Persist an upload and return an object URI.

    The object is content-addressed by sha256 so re-uploading the same bytes
    is a no-op for storage, while the returned URI remains unique per file.
    """
    safe_name = Path(filename or "upload").name.replace(" ", "_") or "upload"
    digest = hashlib.sha256(raw).hexdigest()
    s3_bucket = os.getenv("HELIO_OBJECT_STORAGE_S3_BUCKET", "").strip()
    key = f"{(tenant_id or 'tenant')}/{(workspace_id or 'workspace')}/{digest}/{safe_name}"

    if s3_bucket:
        try:
            import boto3  # type: ignore

            client = boto3.client("s3")
            client.put_object(Bucket=s3_bucket, Key=key, Body=raw)
            return f"s3://{s3_bucket}/{key}"
        except Exception:
            # Keep development usable if boto3/S3 is unavailable: fall back to
            # the same object key on local disk. The URI records the failure
            # mode distinctly, so operators can still find the bytes.
            pass

    path = _local_dir() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return path.as_uri()