// 複数のファイルの文字列を、それぞれ1か所だけ置き換える。置換前・置換後は JSON ファイルで渡す。
// コマンドの引数で渡すと、Git Bash が `/` で始まる値（`// コメント` など）をパスとみなして書き換えてしまうため
// （2026-10-05、PR #16 の振り返り。CLAUDE.md「Claude Code 固有の補足」）。
//
// 使い方: node scripts/replace-once.mjs <spec.json>
//   spec.json は配列。各要素は { "file": "書き換えるファイル", "from": "置換前", "to": "置換後", "count": 件数（任意） }
//   count を書かなければ、置換前はちょうど1か所。書けば、ちょうどその件数で、全部を置き換える（用語の言い換えなど）
// 全部の置換が件数どおりであることを確かめてから書く。1つでも外れたら何も書かずに終了コード 1。
// 同じファイルへの前の置換の置換後に、後の置換前の文字列が含まれるなら誤りにする（二重に当たって化けるのを止める。
// 2026-10-07、「作者でない」を2回当てて「製製作者でない」に化けた）。
// テストは scripts/replace-once.test.mjs（pnpm tools:test）。

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 置換を計算する（書かない）。問題があれば errors に、問題が無ければ書く内容を writes に入れて返す */
export function planReplacements(specs, { cwd = process.cwd(), read = readFileSync } = {}) {
  const contents = new Map();
  /** ファイルごとの、前の置換の [何件目, 置換後] */
  const earlier = new Map();
  const errors = [];
  for (const [i, spec] of specs.entries()) {
    const path = resolve(cwd, spec.file);
    const before = contents.get(path) ?? read(path, 'utf8');
    const overlap = (earlier.get(path) ?? []).find(([, to]) => to.includes(spec.from));
    if (overlap) {
      errors.push(
        `${i + 1}件目（${spec.file}）：置換前の文字列が、${overlap[0]}件目の置換後にも含まれる（二重に当たる）`,
      );
      continue;
    }
    const expected = spec.count ?? 1;
    const count = before.split(spec.from).length - 1;
    if (count !== expected) {
      errors.push(
        `${i + 1}件目（${spec.file}）：置換前の文字列が ${count} 件（${expected}件であるべき）`,
      );
      continue;
    }
    contents.set(path, before.split(spec.from).join(spec.to));
    earlier.set(path, [...(earlier.get(path) ?? []), [i + 1, spec.to]]);
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
