#!/usr/bin/env python3
"""Publish a complete pre-migration backup bundle, or fail deployment."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import uuid

COMPOSE = ["docker", "compose", "-f", "/opt/energiepad/compose.yml", "exec", "-T", "db"]


def private_write(path, content):
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as file:
        file.write(content)
        file.flush()
        os.fsync(file.fileno())


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def create_backup(commit, directory=Path("/var/backups/energiepad"), run=subprocess.run):
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("Expected commit SHA")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".pending-", dir=directory))
    try:
        archive = stage / "database.dump"
        with os.fdopen(os.open(archive, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as output:
            run([*COMPOSE, "sh", "-c", 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],
                stdout=output, stderr=subprocess.PIPE, check=True, timeout=600)
            output.flush()
            os.fsync(output.fileno())
        if archive.stat().st_size == 0:
            raise ValueError("Empty archive")
        with archive.open("rb") as source:
            run([*COMPOSE, "pg_restore", "--list"], stdin=source,
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True, timeout=60)
        with archive.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        private_write(stage / "database.dump.sha256", (digest + "\n").encode())
        now = datetime.datetime.now(datetime.timezone.utc)
        metadata = {"version": 1, "completedAt": now.isoformat(), "migrationTargetCommit": commit,
                    "bytes": archive.stat().st_size, "sha256": digest,
                    "archiveListing": "PASSED", "restoreVerified": False}
        private_write(stage / "manifest.json", (json.dumps(metadata, indent=2) + "\n").encode())
        sync_directory(stage)
        target = directory / f"{now:%Y%m%dT%H%M%SZ}-{commit}-{uuid.uuid4().hex}.backup"
        stage.rename(target)
        sync_directory(directory)
        return target
    finally:
        # Only the temporary directory created by this invocation can be removed.
        if stage.exists():
            shutil.rmtree(stage)


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"[a-f0-9]{40}", sys.argv[1]):
        print("Usage: energiepad-backup <commit-sha>", file=sys.stderr)
        return 2
    try:
        target = create_backup(sys.argv[1])
    except (OSError, ValueError, subprocess.SubprocessError):
        print("Backup failed; migrations must not proceed. No completed backup was confirmed.", file=sys.stderr)
        return 1
    print(f"Backup bundle published: {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
