// ダッシュボード（docs/index.md）の「決めないといけないこと」のうち、要望ファイル以外から集めるもの。
// 正はそれぞれの文書で、ここは見出し・箇条書きを読み取って並べるだけ（SSOT。手で書き写さない）
//   - 未解決論点の「次に詰める候補」（docs/open-questions.md）……PO 向け
//   - 既知の問題のうち、見出しに「判断待ち」を含むもの（docs/architecture/known-issues.md）……開発者向け
//   - 体制の進化ログの未評価の候補（docs/process/evolution.md の「- [ ]」）……開発者向け
import { readFileSync } from 'node:fs';
import { githubSlug } from './slug';

export interface DecisionItem {
  title: string;
  /** サイト内のリンク（base を含まない） */
  link: string;
}

export interface Decisions {
  openQuestions: DecisionItem[];
  knownIssues: DecisionItem[];
  processCandidates: DecisionItem[];
}

declare const data: Decisions;

export { data };

/** 「## 見出し」から次の「## 」までの本文 */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) return '';
  const rest = text.slice(start + heading.length + 5);
  const end = rest.search(/\n## /);
  return end < 0 ? rest : rest.slice(0, end);
}

/** 箇条書きの先頭の要点（太字で始まれば太字、なければ「 — 」の前まで）。Markdown の記号は外す */
function headline(bullet: string): string {
  const bold = bullet.match(/^\*\*(.+?)\*\*/);
  const text = bold ? bold[1] : bullet.split(' — ')[0];
  return text
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

export default {
  watch: ['../open-questions.md', '../architecture/known-issues.md', '../process/evolution.md'],
  load(watchedFiles: string[]): Decisions {
    // watchedFiles はパスの順に並ぶので、ファイル名で引く
    const read = (name: string) => {
      const path = watchedFiles.find((p) => p.replaceAll('\\', '/').endsWith(name));
      if (!path) throw new Error(`ダッシュボードの情報源 ${name} が見つかりません`);
      return readFileSync(path, 'utf8');
    };
    const openQuestionsPath = 'docs/open-questions.md';
    const knownIssuesPath = 'architecture/known-issues.md';
    const evolutionPath = 'process/evolution.md';

    const nextCandidates = '次に詰める候補';
    const openQuestions = section(read(openQuestionsPath), nextCandidates)
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => ({
        title: headline(l.slice(2)),
        link: `/open-questions#${githubSlug(nextCandidates)}`,
      }));

    const knownIssues = [...read(knownIssuesPath).matchAll(/^### (.+)$/gm)]
      .map((m) => m[1])
      .filter((h) => h.includes('判断待ち'))
      .map((h) => ({
        title: h,
        link: `/architecture/known-issues#${githubSlug(h)}`,
      }));

    const candidates = '候補（未評価）';
    const processCandidates = section(read(evolutionPath), candidates)
      .split('\n')
      .filter((l) => l.startsWith('- [ ] '))
      .map((l) => ({
        title: headline(l.slice('- [ ] '.length)),
        link: `/process/evolution#${githubSlug(candidates)}`,
      }));

    return { openQuestions, knownIssues, processCandidates };
  },
};
