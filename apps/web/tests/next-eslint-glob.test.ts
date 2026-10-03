import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { Linter } from 'eslint';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// GHSA-vfj7-8cjw-p6xm: Next 16.3.8's fast-glob dependency is overridden with tinyglobby.
// Exercise the plugin itself so dependency upgrades cannot silently break root discovery.
const require = createRequire(import.meta.url);
const { getRootDirs } = require('@next/eslint-plugin-next/dist/utils/get-root-dirs') as {
  getRootDirs: (context: { cwd: string; settings: { next?: { rootDir?: string | string[] } } }) => string[];
};
let directory: string | undefined;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});
it('preserves default roots and directory-only literal, wildcard, brace and array settings', () => {
  directory = mkdtempSync(path.join(tmpdir(), 'energiepad-eslint-'));
  const web = path.join(directory, 'web'),
    admin = path.join(directory, 'admin');
  mkdirSync(web);
  mkdirSync(admin);
  writeFileSync(path.join(directory, 'file.ts'), '');
  const roots = (rootDir?: string | string[]) =>
    getRootDirs({ cwd: directory!, settings: rootDir ? { next: { rootDir } } : {} })
      .map((p) => path.resolve(p))
      .sort();
  expect(roots()).toEqual([directory]);
  expect(roots(web)).toEqual([web]);
  expect(roots(`${directory}/*`)).toEqual([admin, web]);
  expect(roots(`${directory}/{web,admin}`)).toEqual([admin, web]);
  expect(roots([`${directory}/web`, `${directory}/admin`])).toEqual([admin, web]);
  expect(roots(`${directory}/missing-*`)).toEqual([]);
  // The replacement returns relative paths for absolute patterns. Verify the consuming lint rule
  // still discovers the same pages and reports invalid internal anchors.
  mkdirSync(path.join(web, 'pages'));
  writeFileSync(path.join(web, 'pages', 'about.js'), '');
  const plugin = require('@next/eslint-plugin-next');
  const messages = new Linter().verify('<a href="/about">About</a>', [
    {
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { '@next/next': plugin },
      settings: { next: { rootDir: web } },
      rules: { '@next/next/no-html-link-for-pages': 'error' },
    },
  ]);
  expect(messages.map((message) => message.ruleId)).toEqual(['@next/next/no-html-link-for-pages']);
});
