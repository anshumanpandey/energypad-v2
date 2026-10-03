"""Test shell isolation and failure cleanup with a fake Docker executable."""
import os
import hashlib
from pathlib import Path
import subprocess
import tempfile
import unittest


class RestoreRehearsalTests(unittest.TestCase):
    def run_rehearsal(self, failure="", checksum="valid", legacy=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dump = root / "backup with spaces.dump"
            dump.write_bytes(b"synthetic dump")
            if checksum != "missing":
                Path(str(dump) + ".sha256").write_text(
                    hashlib.sha256(dump.read_bytes()).hexdigest() if checksum == "valid" else "0" * 64
                )
            log = root / "docker.log"
            docker = root / "docker"
            docker.write_text('''#!/usr/bin/env python3
import json, os, sys
with open(os.environ["DOCKER_TEST_LOG"], "a") as log:
    log.write(json.dumps(sys.argv[1:]) + "\\n")
args = sys.argv[1:]
if "-i" in args:
    sys.stdin.buffer.read()
if os.environ.get("DOCKER_TEST_FAILURE") in args:
    sys.exit(1)
''')
            docker.chmod(0o700)
            result = subprocess.run(
                ["bash", str(Path(__file__).with_name("restore-rehearsal.sh")),
                 *(["--legacy-unverified"] if legacy else []), str(dump)],
                env={**os.environ, "PATH": f"{root}:{os.environ['PATH']}",
                     "DOCKER_TEST_LOG": str(log), "DOCKER_TEST_FAILURE": failure},
                capture_output=True, text=True, timeout=10,
            )
            import json
            calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            return result, calls

    def test_isolation_and_cleanup(self):
        result, calls = self.run_rehearsal()
        self.assertEqual(result.returncode, 0, result.stderr)
        run = next(call for call in calls if call[0] == "run")
        self.assertEqual(run[run.index("--network") + 1], "none")
        self.assertEqual(run[-1], "postgres:18-bookworm")
        probe = next(call for call in calls if "pg_isready" in call)
        self.assertEqual(probe[probe.index("-h") + 1], "127.0.0.1")
        for forbidden in ["--volume", "-v", "--mount", "--publish", "-p", "--env-file"]:
            self.assertNotIn(forbidden, run)
        restore = next(call for call in calls if "pg_restore" in call)
        self.assertIn("--single-transaction", restore)
        self.assertIn("--exit-on-error", restore)
        self.assertEqual(calls[-1][:3], ["rm", "--force", "--volumes"])
        self.assertEqual(calls[-1][-1], run[run.index("--name") + 1])

    def test_restore_and_verification_failures_cleanup(self):
        for failure in ["pg_restore", "psql"]:
            with self.subTest(failure=failure):
                result, calls = self.run_rehearsal(failure)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(calls[-1][0], "rm")
                self.assertNotIn("Restore rehearsal passed", result.stderr)

    def test_missing_image_never_creates_container(self):
        result, calls = self.run_rehearsal("inspect")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 1)

    def test_missing_argument(self):
        result = subprocess.run(
            ["bash", str(Path(__file__).with_name("restore-rehearsal.sh"))], capture_output=True
        )
        self.assertEqual(result.returncode, 2)

    def test_checksum_failures_never_start_docker(self):
        for checksum in ["missing", "wrong"]:
            result, calls = self.run_rehearsal(checksum=checksum)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(calls, [])
        result, calls = self.run_rehearsal(checksum="wrong", legacy=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_legacy_opt_in_is_explicit(self):
        result, calls = self.run_rehearsal(checksum="missing", legacy=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("integrity remain unverified", result.stderr)
        self.assertTrue(calls)


if __name__ == "__main__":
    unittest.main()
