// packages/domain のディレクトリ間の依存の向きを、ソースを読んで機械的に確かめる
// （docs/process/rules/architecture.md「packages/domain の中の置き場所」、
// docs/plans/2026-10-03-domainのディレクトリ分割.md D6）。
// 依存の向きの正はルールの表で、ALLOWED はその写し。表と一致することも下のテストで確かめる。
//
// import は正規表現で拾う（コメントの中の import 文も拾うので、コード例をコメントに書くと違反になる）。
// vi.mock など Vitest の API は見ない。

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** 各ディレクトリが import してよい先（同じディレクトリの中は自由） */
const ALLOWED: Record<string, string[]> = {
  check: [],
  user: [],
  card: ['check'],
  library: ['card', 'check'],
  character: ['card', 'check'],
  autoCombat: ['character', 'card', 'check'],
  scenario: ['autoCombat', 'character', 'card', 'check'],
  session: ['scenario', 'autoCombat', 'character', 'card', 'check'],
  soloVillage: ['session', 'scenario', 'autoCombat', 'character', 'card', 'check'],
};

const SELF = 'layers.test.ts';
const PACKAGE_NAME = '@cartagraph/domain';
/** 検査するソースの拡張子 */
const SOURCE_EXT = /\.(c|m)?[jt]sx?$/;

/** import・export … from・副作用だけの import・動的な import の指定子（複数行・引用符・空白のゆれを含む） */
function importSpecifiers(source: string): string[] {
  const patterns = [
    // import X from / import { … } from / import type … from / export { … } from / export * from
    /(?:^|[\s;/}])(?:import|export)(?:\s*type\b)?\s*(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s*as\s+[\w$]+)?|[\w$]+)\s*from\s*(['"`])([^'"`]+)\1/g,
    // import '…'（副作用だけ）
    /(?:^|[\s;/}])import\s*(['"`])([^'"`]+)\1/g,
    // import('…') と typeof import('…')
    /import\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
  ];
  return patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[2]));
}

/** 依存の向き・置き場所の違反を、人が読める文で返す。キーは src/ からの posix の相対パス */
function layerViolations(files: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const [file, source] of Object.entries(files)) {
    const [dir, ...rest] = file.split('/');
    if (rest.length === 0) {
      if (file !== SELF) errors.push(`${file}：src/ の直下にファイルを置かない`);
      continue;
    }
    const known = Object.hasOwn(ALLOWED, dir);
    if (!known) errors.push(`${file}：依存の表に無いディレクトリ（${dir}/）`);
    if (/^index\./.test(posix.basename(file))) {
      errors.push(`${file}：index（barrel）を置かない`);
    }

    for (const spec of importSpecifiers(source)) {
      if (spec === PACKAGE_NAME || spec.startsWith(`${PACKAGE_NAME}/`)) {
        errors.push(`${file} → ${spec}：domain の中は相対パスで import する`);
        continue;
      }
      if (!spec.startsWith('.')) continue; // 外部パッケージ
      if (spec.includes('\\')) {
        errors.push(`${file} → ${spec}：パスの区切りは / にする`);
        continue;
      }
      const target = posix.normalize(posix.join(posix.dirname(file), spec));
      if (target === '..' || target.startsWith('../')) {
        errors.push(`${file} → ${spec}：src/ の外を import しない`);
        continue;
      }
      const targetDir = target.split('/')[0];
      if (target === '.' || (!target.includes('/') && !Object.hasOwn(ALLOWED, targetDir))) {
        errors.push(`${file} → ${spec}：src/ の直下を import しない`);
        continue;
      }
      if (targetDir === dir) continue;
      if (!known || !ALLOWED[dir].includes(targetDir)) {
        errors.push(`${file} → ${spec}：${dir}/ は ${targetDir}/ に依存できない`);
      }
    }
  }
  return errors;
}

describe('layerViolations', () => {
  const check = (file: string, spec: string) =>
    layerViolations({ [file]: `import { x } from '${spec}';\n` });

  it('同じディレクトリ・下の層（隣・飛ばし）・表で許した先は違反にしない', () => {
    expect(check('session/transition.ts', './model')).toEqual([]);
    expect(check('session/transition.ts', '../scenario/model')).toEqual([]);
    expect(check('soloVillage/rules.ts', '../check/model')).toEqual([]);
    expect(check('library/model.ts', '../card/model')).toEqual([]);
  });

  it.each([
    ['session/transition.ts', '../soloVillage/rules', 'session/', 'soloVillage/'],
    ['card/model.ts', '../library/model', 'card/', 'library/'],
    ['check/model.ts', '../user/model', 'check/', 'user/'],
    ['user/model.ts', '../card/model', 'user/', 'card/'],
    ['library/model.ts', '../user/model', 'library/', 'user/'],
  ])('%s → %s は違反', (file, spec, from, to) => {
    expect(check(file, spec)).toEqual([`${file} → ${spec}：${from} は ${to} に依存できない`]);
  });

  it.each([
    ['import type', "import type { Scenario } from '../scenario/model';"],
    ['import { type }', "import { type Scenario } from '../scenario/model';"],
    ['既定の import', "import scenario from '../scenario/model';"],
    ['複数行', "import {\n  type Scenario,\n  scenarioSchema,\n} from '../scenario/model';"],
    ['export {} from', "export { scenarioSchema } from '../scenario/model';"],
    ['export * from', "export * from '../scenario/model';"],
    ['export type {} from', "export type { Scenario } from '../scenario/model';"],
    ['副作用だけ', "import '../scenario/model';"],
    ['動的な import', "const m = await import('../scenario/model');"],
    ['typeof import', "type M = typeof import('../scenario/model');"],
    ['拡張子付き', "import { x } from '../scenario/model.ts';"],
    ['ディレクトリだけ', "import { x } from '../scenario';"],
    ['二重引用符', 'import { x } from "../scenario/model";'],
    ['空白なし', "import{ x } from '../scenario/model';"],
    ['空白なしの export *', "export*from '../scenario/model';"],
    ['空白なしの import type', "import type{ X } from '../scenario/model';"],
    ['コメントの直後', "/* x */import { x } from '../scenario/model';"],
    ['テンプレートリテラル', 'const m = await import(`../scenario/model`);'],
    ['export * as', "export * as ns from '../scenario/model';"],
    ['既定と名前つき', "import d, { x } from '../scenario/model';"],
    ['既定と名前空間', "import d, * as ns from '../scenario/model';"],
    ['export type *', "export type * from '../scenario/model';"],
  ])('書き方のゆれ（%s）も違反として拾う', (_, source) => {
    const errors = layerViolations({ 'card/model.ts': source });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(
      /^card\/model\.ts → \.\.\/scenario.*：card\/ は scenario\/ に依存できない$/,
    );
  });

  it('正規化してから判定する（./../ や行って戻るパスもすり抜けない）', () => {
    expect(check('card/model.ts', './../scenario/model')).toEqual([
      'card/model.ts → ./../scenario/model：card/ は scenario/ に依存できない',
    ]);
    expect(check('card/model.ts', '../card/../scenario/model')).toEqual([
      'card/model.ts → ../card/../scenario/model：card/ は scenario/ に依存できない',
    ]);
    expect(check('card/model.ts', '../card/condition')).toEqual([]);
  });

  it('src/ の直下を指す import と、バックスラッシュの区切りは違反', () => {
    expect(check('card/model.ts', '..')).toEqual([
      'card/model.ts → ..：src/ の直下を import しない',
    ]);
    expect(check('card/model.ts', '../layers.test')).toEqual([
      'card/model.ts → ../layers.test：src/ の直下を import しない',
    ]);
    expect(check('card/model.ts', '..\\scenario\\model')).toEqual([
      'card/model.ts → ..\\scenario\\model：パスの区切りは / にする',
    ]);
  });

  it('src/ の外への import と、自分のパッケージ名での import は違反', () => {
    expect(check('card/model.ts', '../../../apps/web/src/lib/api')).toEqual([
      'card/model.ts → ../../../apps/web/src/lib/api：src/ の外を import しない',
    ]);
    expect(check('card/model.ts', '@cartagraph/domain/check/model')).toEqual([
      'card/model.ts → @cartagraph/domain/check/model：domain の中は相対パスで import する',
    ]);
  });

  it('外部パッケージは違反にしない', () => {
    expect(
      layerViolations({
        'card/model.ts': "import { z } from 'zod';\nimport { readFileSync } from 'node:fs';",
      }),
    ).toEqual([]);
  });

  it('置き場所：直下のファイル・表に無いディレクトリ・index.ts は違反（このテスト自身は直下でよい）', () => {
    expect(
      layerViolations({
        'x.ts': '',
        'misc/x.ts': '',
        'card/index.ts': '',
        'card/sub/index.ts': '',
        'card/index.mts': '',
        'y.tsx': '',
        'constructor/x.ts': "import { x } from '../card/model';",
        [SELF]: '',
      }),
    ).toEqual([
      'x.ts：src/ の直下にファイルを置かない',
      'misc/x.ts：依存の表に無いディレクトリ（misc/）',
      'card/index.ts：index（barrel）を置かない',
      'card/sub/index.ts：index（barrel）を置かない',
      'card/index.mts：index（barrel）を置かない',
      'y.tsx：src/ の直下にファイルを置かない',
      'constructor/x.ts：依存の表に無いディレクトリ（constructor/）',
      'constructor/x.ts → ../card/model：constructor/ は card/ に依存できない',
    ]);
  });

  it('誤りが複数あれば、すべて報告する', () => {
    expect(
      layerViolations({
        'card/model.ts':
          "import { a } from '../scenario/model';\nimport { b } from '../session/model';",
      }),
    ).toEqual([
      'card/model.ts → ../scenario/model：card/ は scenario/ に依存できない',
      'card/model.ts → ../session/model：card/ は session/ に依存できない',
    ]);
  });
});

describe('packages/domain/src の実ファイル', () => {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const files = Object.fromEntries(
    readdirSync(srcDir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && SOURCE_EXT.test(d.name))
      .map((d) =>
        `${d.parentPath}${sep}${d.name}`
          .slice(srcDir.length + 1)
          .split(sep)
          .join('/'),
      )
      .filter((f) => f !== SELF)
      .map((f) => [f, readFileSync(`${srcDir}/${f}`, 'utf8')]),
  );

  it('走査できている（決まったファイルがあり、相対 import を見つけている）', () => {
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['card/condition.ts', 'session/transition.ts', 'scenario/model.ts']),
    );
    const relativeImports = Object.values(files).flatMap((s) =>
      importSpecifiers(s).filter((x) => x.startsWith('.')),
    );
    expect(relativeImports.length).toBeGreaterThan(0);
    expect(importSpecifiers(files['soloVillage/rules.ts'] ?? '')).toContain('../card/condition');
  });

  it('依存の向きと置き場所の違反が無い', () => {
    expect(layerViolations(files)).toEqual([]);
  });
});

describe('ルールの表と ALLOWED', () => {
  it('docs/process/rules/architecture.md「依存の向き」の表と一致する', () => {
    const srcDir = dirname(fileURLToPath(import.meta.url));
    const rule = readFileSync(`${srcDir}/../../../docs/process/rules/architecture.md`, 'utf8');
    const section = rule.slice(
      rule.indexOf('### 依存の向き'),
      rule.indexOf('### 仕様ページに合わせる'),
    );
    const rows = section
      .split('\n')
      .filter((l) => /^\| `[\w]+\/` \|/.test(l))
      .map((l) => l.split('|').map((c) => c.trim()));
    const fromRule = Object.fromEntries(
      rows.map((cells) => [
        cells[1].replace(/[`/]/g, ''),
        cells[3] === 'なし' ? [] : cells[3].split('・').map((c) => c.replace(/[`/]/g, '')),
      ]),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(fromRule).toEqual(ALLOWED);
  });
});
