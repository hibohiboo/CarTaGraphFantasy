// main の最新の CI（.github/workflows/ci.yml）が失敗していないかを確かめ、失敗していれば知らせる。
// 2026-10-04、PR #14 のテストが CI でだけときどき落ち、main でも失敗していたのに、次の PR の CI で落ちるまで
// 誰も気づかなかった（docs/process/evolution.md）。開発サイクルの始め（プラン作成の前）に流す
// （docs/process/index.md。Claude Code では .claude/settings.json の SessionStart フックが自動で流す）。
//
// gh が無い・ネットワークが無いなどで確かめられないときは、その旨を1行出すだけで、常に終了コード 0 で終わる
// （セッションの開始を止めない）。テストは scripts/check-main-ci.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** gh run list の結果（新しい順）から、知らせる文を作る。知らせることが無ければ空文字 */
export function summarize(runs) {
  const done = runs.filter((r) => r.status === 'completed');
  const latest = done[0];
  if (!latest) return '';
  if (latest.conclusion === 'success' || latest.conclusion === 'cancelled') return '';
  return [
    `[main の CI] 最新の CI が ${latest.conclusion} です（${latest.headSha.slice(0, 7)} ${latest.displayTitle}）。`,
    `作業を始める前に原因を確かめてください: ${latest.url}`,
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = spawnSync(
    'gh',
    [
      'run',
      'list',
      '--branch',
      'main',
      '--workflow',
      'ci.yml',
      '--limit',
      '5',
      '--json',
      'status,conclusion,headSha,displayTitle,url',
    ],
    { encoding: 'utf8', timeout: 15000 },
  );
  if (r.status !== 0) {
    console.log(
      '[main の CI] gh で確かめられませんでした（gh が無いか、ネットワークに届かない）。',
    );
  } else {
    const message = summarize(JSON.parse(r.stdout || '[]'));
    if (message) console.log(message);
  }
}
