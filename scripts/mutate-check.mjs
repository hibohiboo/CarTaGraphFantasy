// 「守っている条件を一時的に外して、テストが落ちることを確かめる」（docs/process/rules/testing.md「骨抜き禁止」）を
// 機械で行う。外す書き換えが1件だけ当たることを確かめてから書き換え、テストを流し、必ず元に戻す。
//
// 使い方: node scripts/mutate-check.mjs <spec.json>
//   spec.json は配列。各要素は { "name": "説明", "file": "書き換えるファイル", "from": "置換前", "to": "置換後", "test": "テストのコマンド" }
//   （from・to は複数行でもよい。クォートの崩れを避けるため、引数ではなく JSON ファイルで渡す）
// 結果: 全部の書き換えでテストが落ちれば 0。テストが通ってしまった（条件が守られていない）ものか、
//       書き換えが当たらなかったものがあれば 1。
// テストは scripts/mutate-check.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 1件の書き換えを確かめる。戻り値の status は
 * caught（テストが落ちた＝条件が守られている）／survived（テストが通った）／not-applied（置換が1件でない）
 */
export function checkMutation(spec, { cwd = process.cwd(), stdio = 'ignore' } = {}) {
  const path = resolve(cwd, spec.file);
  const original = readFileSync(path, 'utf8');
  const count = original.split(spec.from).length - 1;
  if (count !== 1)
    return { status: 'not-applied', detail: `置換前の文字列が ${count} 件（1件であるべき）` };
  try {
    writeFileSync(
      path,
      original.replace(spec.from, () => spec.to),
    );
    const run = spawnSync(spec.test, { cwd, shell: true, stdio });
    return run.status === 0
      ? { status: 'survived', detail: '条件を外してもテストが通った' }
      : { status: 'caught', detail: 'テストが落ちた' };
  } finally {
    writeFileSync(path, original);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error('使い方: node scripts/mutate-check.mjs <spec.json>');
    process.exit(2);
  }
  const specs = JSON.parse(readFileSync(specPath, 'utf8'));
  let ok = true;
  for (const spec of specs) {
    const r = checkMutation(spec);
    if (r.status !== 'caught') ok = false;
    const mark = r.status === 'caught' ? 'OK' : 'NG';
    console.log(`${mark} ${spec.name ?? spec.file}: ${r.detail}`);
  }
  process.exit(ok ? 0 : 1);
}
