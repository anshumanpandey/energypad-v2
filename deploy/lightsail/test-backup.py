import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("backup.py"))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
COMMIT = "a" * 40
DATA = b"synthetic custom archive fixture"


class BackupTests(unittest.TestCase):
    def test_complete_private_bundle_after_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            calls = []
            def run(command, **options):
                calls.append(command)
                self.assertEqual(list(root.glob("*.backup")), [])
                if "pg_restore" in command:
                    self.assertEqual(options["stdin"].read(), DATA)
                else:
                    options["stdout"].write(DATA)
                self.assertTrue(options["check"])
                self.assertIn(options["timeout"], [60, 600])
            target = backup.create_backup(COMMIT, root, run)
            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0][:7], backup.COMPOSE)
            self.assertEqual(calls[1][-2:], ["pg_restore", "--list"])
            self.assertEqual(list(root.glob(".pending-*")), [])
            self.assertEqual((target.stat().st_mode & 0o777), 0o700)
            for file in target.iterdir():
                self.assertEqual(file.stat().st_mode & 0o777, 0o600)
            digest = hashlib.sha256(DATA).hexdigest()
            self.assertEqual((target / "database.dump.sha256").read_text().strip(), digest)
            manifest = json.loads((target / "manifest.json").read_text())
            self.assertEqual(manifest["sha256"], digest)
            self.assertEqual(manifest["bytes"], len(DATA))
            self.assertEqual(manifest["migrationTargetCommit"], COMMIT)
            self.assertIs(manifest["restoreVerified"], False)

    def test_failures_never_publish_and_preserve_existing_backups(self):
        for failure in ["dump", "empty", "list", "timeout", "metadata"]:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                old = root / "previous.dump"
                old.write_bytes(b"preserve")
                def run(command, **options):
                    listing = "pg_restore" in command
                    if not listing and failure != "empty":
                        options["stdout"].write(DATA)
                    if failure == "timeout":
                        raise subprocess.TimeoutExpired(command, 600)
                    if (failure == "dump" and not listing) or (failure == "list" and listing):
                        raise subprocess.CalledProcessError(1, command, stderr="private-secret")
                if failure == "metadata":
                    with patch.object(backup, "private_write", side_effect=OSError("disk full")):
                        with self.assertRaises(OSError):
                            backup.create_backup(COMMIT, root, run)
                else:
                    with self.assertRaises((ValueError, subprocess.SubprocessError)):
                        backup.create_backup(COMMIT, root, run)
                self.assertEqual(list(root.iterdir()), [old])
                self.assertEqual(old.read_bytes(), b"preserve")

    def test_repeated_release_never_overwrites(self):
        with tempfile.TemporaryDirectory() as directory:
            def run(command, **options):
                if "pg_restore" not in command:
                    options["stdout"].write(DATA)
            first = backup.create_backup(COMMIT, Path(directory), run)
            second = backup.create_backup(COMMIT, Path(directory), run)
            self.assertNotEqual(first, second)
            self.assertTrue(first.exists() and second.exists())

    def test_invalid_sha_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                backup.create_backup("../not-a-release", root)
            self.assertEqual(list(root.iterdir()), [])

    def test_cli_failure_is_sanitized(self):
        output = io.StringIO()
        with patch("sys.argv", ["backup.py", COMMIT]), patch.object(backup, "create_backup", side_effect=OSError("private-secret")), contextlib.redirect_stderr(output):
            self.assertEqual(backup.main(), 1)
        self.assertNotIn("private-secret", output.getvalue())


if __name__ == "__main__":
    unittest.main()
