// 進め方に関わるファイル（docs/process/ のルール・AGENTS.md・CLAUDE.md・.claude/）を変えたのに、
// 体制の進化ログ（docs/process/evolution.md）が変わっていないコミットを止める（.githooks/commit-msg から呼ばれる）。
// どう進化してきたかを後から辿れるように、記録を漏らさないため（2026-10-10、AGENTS.md と CLAUDE.md の重複を
// 直したコミットで、ログへの記録を漏らした）。
// 記録が要らない変更（誤字の修正など）は、コミットメッセージに「進化ログ不要: <理由>」の行を書けば通す。
//
// 使い方: node scripts/check-evolution-log.mjs <コミットメッセージのファイル>
// テストは scripts/check-evolution-log.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EVOLUTION_LOG = 'docs/process/evolution.md';

/** 前の月の項目を退避した進化ログ（docs/process/evolution-archive/<年-月>.md） */
const EVOLUTION_ARCHIVE = /^docs\/process\/evolution-archive\//;

/**
 * 進め方に関わるファイル。ルールの文書と、エージェントへの指示（入口・.claude/）だけを見る。自動メモリ（Claude 固有の記憶）は除く。
 * 検査のスクリプト・git フック・CI・biome.json は見ない（2026-10-11 に絞った。直すたびに記録を求めると、
 * 記録の手間が変更そのものより重くなる。仕組みを足したときの記録は、ルールの文書の変更と一緒に残る）
 */
const PROCESS_FILES = [
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^docs\/process\//,
  /^\.claude\/(?!memory\/)/,
];

/** そのパスが進め方に関わるファイルか（進化ログそのものと、退避した進化ログは除く） */
export function isProcessFile(path) {
  return (
    path !== EVOLUTION_LOG &&
    !EVOLUTION_ARCHIVE.test(path) &&
    PROCESS_FILES.some((re) => re.test(path))
  );
}

/** コミットメッセージの「進化ログ不要: <理由>」の理由。無ければ null（# で始まる行は git が消すので見ない） */
export function skipReason(message) {
  const lines = message.split('\n').filter((line) => !line.startsWith('#'));
  for (const line of lines) {
    const reason = line.match(/^進化ログ不要[:：]\s*(.*)$/)?.[1].trim();
    if (reason) return reason;
  }
  return null;
}

/** 止める理由（人が読むメッセージ）。通すなら null */
export function checkEvolutionLog({ staged, message }) {
  if (staged.includes(EVOLUTION_LOG) || skipReason(message)) return null;
  const processFiles = staged.filter(isProcessFile);
  if (!processFiles.length) return null;
  return [
    `進め方に関わるファイルを変えたのに、体制の進化ログ（${EVOLUTION_LOG}）が変わっていません。`,
    ...processFiles.map((p) => `  - ${p}`),
    'ログの「採用済み」（または「候補」）に記録して一緒にコミットしてください（書式は evolution.md の「採用済み」）。',
    '記録が要らない変更（誤字の修正など）なら、コミットメッセージに「進化ログ不要: <理由>」の行を書いてください。',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const git = (args) => spawnSync('git', args, { encoding: 'utf8' });
  // マージのコミットは、取り込む側のコミットで確かめ済み
  if (git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']).status === 0) process.exit(0);
  const staged = git(['diff', '--cached', '--name-only']).stdout.split('\n').filter(Boolean);
  const error = checkEvolutionLog({ staged, message: readFileSync(process.argv[2], 'utf8') });
  if (error) {
    console.error(`[commit-msg] ${error}`);
    process.exit(1);
  }
}
