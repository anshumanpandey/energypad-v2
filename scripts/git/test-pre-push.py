"""Exercise hook wiring with disposable Git remotes and stubbed expensive suites."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[2]


class PrePushTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.repo = self.base / 'repo'
        for folder in ['scripts/git', '.githooks', 'apps/web/node_modules',
                       'deploy/lightsail', 'scripts/migration', 'bin']:
            (self.repo / folder).mkdir(parents=True)
        for path in ['scripts/git/test-before-push.sh', 'scripts/git/install-hooks.sh', '.githooks/pre-push']:
            shutil.copy2(SOURCE / path, self.repo / path)
        (self.repo / 'deploy/lightsail/test-restore-docker.sh').write_text('exit 0\n')
        (self.repo / 'deploy/lightsail/test-fixture.py').touch()
        (self.repo / 'scripts/migration/test-fixture.py').touch()
        self.log = self.base / 'commands.log'
        for name in ['node', 'npm', 'python3', 'docker']:
            tool = self.repo / 'bin' / name
            tool.write_text('#!/bin/sh\n'
                            f'echo "{name} $*" >> "$CHECK_LOG"\n'
                            f'[ "{name} $*" != "${{FAIL_STAGE:-}}" ]\n')
            tool.chmod(0o755)
        # A real Git hook exports repository-specific variables. Never let them
        # point fixture Git commands back at the developer's checkout.
        clean_env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
        self.env = {**clean_env, 'PATH': str(self.repo / 'bin') + os.pathsep + os.environ['PATH'],
                    'CHECK_LOG': str(self.log), 'GIT_CONFIG_NOSYSTEM': '1',
                    'GIT_CONFIG_GLOBAL': os.devnull}
        self.env.pop('WORKBOOK_FIXTURE_DIR', None)
        self.env.pop('FAIL_STAGE', None)

    def run_command(self, *args):
        return subprocess.run(args, cwd=self.repo, env=self.env, capture_output=True, text=True)

    def test_success_runs_both_browser_modes_before_final_types_and_build(self):
        result = self.run_command('bash', 'scripts/git/test-before-push.sh')
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text().splitlines()
        expected = ['npm run format:check', 'npm run lint', 'npm run db:generate', 'npm test',
                    'npm run test:integration', 'npm run test:e2e', 'npm run test:e2e:freeze',
                    'npm run typecheck', 'npm run build']
        self.assertEqual([c for c in commands if c.startswith('npm ')], expected)

    def test_failure_stops_later_suites(self):
        self.env['FAIL_STAGE'] = 'npm test'
        result = self.run_command('bash', 'scripts/git/test-before-push.sh')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('npm run test:integration', self.log.read_text())

    def test_missing_docker_blocks_before_tests(self):
        self.env['FAIL_STAGE'] = 'docker info'
        result = self.run_command('bash', 'scripts/git/test-before-push.sh')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Docker is unavailable', result.stderr)
        self.assertNotIn('npm test', self.log.read_text())

    def test_real_git_push_is_blocked_then_permitted(self):
        self.assertEqual(self.run_command('git', 'init', '-b', 'main').returncode, 0)
        for key, value in [('user.name', 'Hook test'), ('user.email', 'hook@example.test')]:
            self.assertEqual(self.run_command('git', 'config', key, value).returncode, 0)
        self.run_command('git', 'add', '.')
        self.assertEqual(self.run_command('git', 'commit', '-m', 'Synthetic hook fixture').returncode, 0)
        remote = self.base / 'remote.git'
        self.assertEqual(self.run_command('git', 'init', '--bare', str(remote)).returncode, 0)
        self.run_command('git', 'remote', 'add', 'origin', str(remote))
        self.assertEqual(self.run_command('bash', 'scripts/git/install-hooks.sh').returncode, 0)
        self.env['FAIL_STAGE'] = 'npm run test:e2e:freeze'
        self.assertNotEqual(self.run_command('git', 'push', 'origin', 'main').returncode, 0)
        refs = self.run_command('git', '--git-dir', str(remote), 'show-ref')
        self.assertEqual(refs.stdout, '')
        del self.env['FAIL_STAGE']
        result = self.run_command('git', 'push', 'origin', 'main')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('refs/heads/main', self.run_command('git', '--git-dir', str(remote), 'show-ref').stdout)


if __name__ == '__main__':
    unittest.main()
