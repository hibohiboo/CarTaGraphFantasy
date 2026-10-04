// 複数のファイルの文字列を、それぞれ1か所だけ置き換える。置換前・置換後は JSON ファイルで渡す。
// コマンドの引数で渡すと、Git Bash が `/` で始まる値（`// コメント` など）をパスとみなして書き換えてしまうため
// （2026-10-05、PR #16 の振り返り。CLAUDE.md「Claude Code 固有の補足」）。
//
// 使い方: node scripts/replace-once.mjs <spec.json>
//   spec.json は配列。各要素は { "file": "書き換えるファイル", "from": "置換前", "to": "置換後" }
// 全部の置換が「置換前がちょうど1か所」であることを確かめてから書く。1つでも外れたら何も書かずに終了コード 1。
// テストは scripts/replace-once.test.mjs（pnpm tools:test）。

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 置換を計算する（書かない）。問題があれば errors に、問題が無ければ書く内容を writes に入れて返す */
export function planReplacements(specs, { cwd = process.cwd(), read = readFileSync } = {}) {
  const contents = new Map();
  const errors = [];
  for (const [i, spec] of specs.entries()) {
    const path = resolve(cwd, spec.file);
    const before = contents.get(path) ?? read(path, 'utf8');
    const count = before.split(spec.from).length - 1;
    if (count !== 1) {
      errors.push(`${i + 1}件目（${spec.file}）：置換前の文字列が ${count} 件（1件であるべき）`);
      continue;
    }
    contents.set(
      path,
      before.replace(spec.from, () => spec.to),
    );
  }
  return { errors, writes: errors.length ? [] : [...contents] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error('使い方: node scripts/replace-once.mjs <spec.json>');
    process.exit(2);
  }
  const { errors, writes } = planReplacements(JSON.parse(readFileSync(specPath, 'utf8')));
  if (errors.length) {
    for (const e of errors) console.error(e);
    console.error('何も書き換えていません');
    process.exit(1);
  }
  for (const [path, text] of writes) writeFileSync(path, text);
  console.log(`${writes.length} ファイルを書き換えました`);
}
