import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { EN } from './en.ts';
import { UK } from './uk.ts';

const SRC = path.resolve(import.meta.dirname, '..');

// Every Russian string passed to t() in the source code.
function sourceKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const file of walk(SRC).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts') && !f.includes(`${path.sep}i18n${path.sep}`))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't') {
        const arg = n.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) keys.add(arg.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return keys;
}

const placeholders = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(',');

describe('translations', () => {
  const keys = sourceKeys();
  for (const [lang, dict] of [
    ['uk', UK],
    ['en', EN],
  ] as const) {
    it(`${lang}: every source string is translated and keeps its placeholders`, () => {
      const missing = [...keys].filter((k) => !dict[k]);
      assert.deepEqual(missing.slice(0, 10), [], `${missing.length} strings without a ${lang} translation`);
      const broken = [...keys].filter((k) => placeholders(k) !== placeholders(dict[k]));
      assert.deepEqual(broken.slice(0, 10), []);
    });

    it(`${lang}: has no stale entries`, () => {
      const stale = Object.keys(dict).filter((k) => !keys.has(k));
      assert.deepEqual(stale.slice(0, 10), [], `${stale.length} entries are not used in the code`);
    });
  }

  it('uk has no Russian-only letters and en has no Cyrillic', () => {
    assert.deepEqual(Object.values(UK).filter((v) => /[ыэъёЫЭЪЁ]/.test(v)).slice(0, 5), []);
    assert.deepEqual(Object.values(EN).filter((v) => /[А-Яа-яЁёІіЇїЄєҐґ]/.test(v)).slice(0, 5), []);
  });
});
