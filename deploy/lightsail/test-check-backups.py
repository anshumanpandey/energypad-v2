import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("check_backups", Path(__file__).with_name("check-backups.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
NOW = dt.datetime(2026, 9, 26, tzinfo=dt.timezone.utc)


class BackupCheckTests(unittest.TestCase):
    def bundle(self, root, age=1):
        path = root / f"{age}.backup"
        path.mkdir()
        (path / "database.dump").write_bytes(b"fixture")
        (path / "database.dump.sha256").write_text("a" * 64 + "\n")
        (path / "manifest.json").write_text(json.dumps({
            "version": 1, "bytes": 7, "sha256": "a" * 64,
            "archiveListing": "PASSED", "completedAt": (NOW - dt.timedelta(hours=age)).isoformat()}))
        return path

    def test_fresh_metadata_is_not_integrity_or_restore_acceptance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.bundle(root)
            before = {p.name: p.read_bytes() for p in (root / "1.backup").iterdir()}
            result = module.check(root, 24, 0, NOW)
            self.assertEqual(result["status"], "HEALTHY")
            self.assertFalse(result["integrityVerified"])
            self.assertFalse(result["restoreVerified"])
            self.assertEqual(before, {p.name: p.read_bytes() for p in (root / "1.backup").iterdir()})

    def test_latest_timestamp_and_threshold_boundary(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.bundle(root, 50)
            self.bundle(root, 24)
            self.assertEqual(module.check(root, 24, 0, NOW)["status"], "HEALTHY")
            self.assertIn("STALE_BACKUP", module.check(root, 23, 0, NOW)["issues"])

    def test_empty_pending_and_low_capacity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".pending-fixture").mkdir()
            (root / "legacy.dump").write_bytes(b"ignored")
            with patch.object(module.shutil, "disk_usage", return_value=type("Usage", (), {"free": 9})()):
                result = module.check(root, 24, 10, NOW)
            self.assertEqual(result["issues"], ["LOW_DISK_SPACE", "PENDING_BACKUP", "NO_COMPLETED_BACKUP"])

    def test_invalid_bundles_never_hide_behind_fresh_bundle(self):
        for fault in ("future", "naive", "size", "hash", "missing", "symlink", "oversize", "json"):
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                self.bundle(root)
                bad = self.bundle(root, 2)
                manifest = bad / "manifest.json"
                data = json.loads(manifest.read_text())
                if fault == "future": data["completedAt"] = (NOW + dt.timedelta(hours=1)).isoformat()
                if fault == "naive": data["completedAt"] = "2026-09-25T00:00:00"
                if fault == "size": data["bytes"] = 8
                if fault == "hash": data["sha256"] = "b" * 64
                manifest.write_text(json.dumps(data))
                if fault == "missing": (bad / "database.dump").unlink()
                if fault == "symlink":
                    (bad / "database.dump").unlink()
                    (bad / "database.dump").symlink_to(root / "1.backup" / "database.dump")
                if fault == "oversize": manifest.write_text(" " * 8193)
                if fault == "json": manifest.write_text("[")
                result = module.check(root, 24, 0, NOW)
                self.assertEqual(result["status"], "ATTENTION")
                self.assertEqual(result["invalidBundles"], 1)

    def test_collection_failure_is_sanitized(self):
        result = module.check(Path("/missing/private-secret"), 24, 0, NOW)
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertNotIn("private-secret", json.dumps(result))

    def test_cli_requires_explicit_valid_thresholds(self):
        for args in ([], ["--max-age-hours", "nan", "--min-free-bytes", "0"],
                     ["--max-age-hours", "24", "--min-free-bytes", "-1"]):
            run = subprocess.run([sys.executable, str(Path(module.__file__)), *args], capture_output=True)
            self.assertEqual(run.returncode, 2)
        with tempfile.TemporaryDirectory() as temp:
            run = subprocess.run([sys.executable, str(Path(module.__file__)), "--directory", temp,
                                  "--max-age-hours", "24", "--min-free-bytes", "0"], capture_output=True)
            self.assertEqual(run.returncode, 1)
            self.assertEqual(json.loads(run.stdout)["status"], "ATTENTION")


if __name__ == "__main__":
    unittest.main()
