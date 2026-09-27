"""Control-flow tests only; the separate CI job runs actual PostgreSQL."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class RestoreDockerDriverTests(unittest.TestCase):
    def run_driver(self, failure=""):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docker = root / "docker"
            docker.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
root = Path(os.environ['RESTORE_DRIVER_ROOT'])
a = sys.argv[1:]
with (root / 'calls').open('a') as out:
    out.write(json.dumps(a) + '\\n')
failure = os.environ.get('RESTORE_DRIVER_FAILURE')
if a[0] == 'exec':
    if 'pg_dump' in a:
        if failure == 'dump': sys.exit(1)
        print('unfinished' if (root / 'unfinished').exists() else 'valid')
    elif 'pg_restore' in a:
        (root / 'restoring').write_bytes(sys.stdin.buffer.read())
    elif 'psql' in a:
        sql = sys.stdin.read()
        if 'fixture' in a:
            if "VALUES ('unfinished'" in sql: (root / 'unfinished').touch()
        else:
            if 'unfinished' in (root / 'restoring').read_text():
                print('Missing migration history or unresolved failed migration', file=sys.stderr)
                sys.exit(1)
            print('table_name,row_count')
            print('EmptyFixture,0')
            print('RestoreFixture,' + ('4' if failure == 'counts' else '3'))
            print('_prisma_migrations,1')
''')
            docker.chmod(0o700)
            result = subprocess.run(
                ['bash', str(Path(__file__).with_name('test-restore-docker.sh'))],
                env={**os.environ, 'PATH': f"{root}:{os.environ['PATH']}",
                     'RESTORE_DRIVER_ROOT': str(root), 'RESTORE_DRIVER_FAILURE': failure},
                capture_output=True, text=True, timeout=15)
            calls = [json.loads(line) for line in (root / 'calls').read_text().splitlines()]
            return result, calls

    def assert_cleaned(self, calls):
        created = [c[c.index('--name') + 1] for c in calls if c[0] == 'run']
        removed = [c[-1] for c in calls if c[:3] == ['rm', '--force', '--volumes']]
        self.assertCountEqual(created, removed)
        for call in calls:
            if call[0] == 'run':
                self.assertEqual(call[call.index('--network') + 1], 'none')
                for option in ['--publish', '-p', '--volume', '-v', '--env-file', '--mount']:
                    self.assertNotIn(option, call)

    def test_success_and_expected_migration_failure(self):
        result, calls = self.run_driver()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('failed-migration rejection passed', result.stdout)
        self.assertEqual(len([c for c in calls if c[0] == 'run']), 3)
        self.assert_cleaned(calls)

    def test_failed_dump_cleans_source(self):
        result, calls = self.run_driver('dump')
        self.assertNotEqual(result.returncode, 0)
        self.assert_cleaned(calls)

    def test_wrong_counts_fail_and_clean_both_databases(self):
        result, calls = self.run_driver('counts')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('counts did not match', result.stderr)
        self.assert_cleaned(calls)


if __name__ == '__main__':
    unittest.main()
