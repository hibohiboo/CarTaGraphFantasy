// 「体制の進化のタイムライン」（docs/process/timeline.md）のデータ。正は体制の進化ログ（docs/process/evolution.md と、前の月を退避した evolution-archive/）で、
// ここはビルド時に「採用済み」「却下」の見出しと「きっかけ」「止め方」を読み取って並べるだけ（書き写さない）。
// 読み取りと集計は scripts/evolution-timeline.mjs（単体テストあり）。きっかけ・止め方が読めない項目があればビルドを止める
import { readFileSync } from 'node:fs';
// 型定義の無い .mjs（scripts/ の純粋関数。pnpm tools:test でテストしている）。VitePress のビルドは型検査しない
import {
  byMonth,
  countBy,
  MEANS,
  parseEvolution,
  TRIGGERS,
} from '../../scripts/evolution-timeline.mjs';
import { githubSlug } from './slug';

export interface TimelineEntry {
  date: string;
  title: string;
  status: '採用' | '却下';
  triggers: string[];
  means: string[];
  /** 進化ログの見出しへのリンク（base を含まない） */
  link: string;
}

export interface Timeline {
  entries: TimelineEntry[];
  triggers: { name: string; count: number }[];
  means: { name: string; count: number }[];
  months: { month: string; adopted: number; machine: number }[];
}

declare const data: Timeline;

export { data };

export default {
  // 前の月の項目は evolution-archive/<年-月>.md に退避する（書式は進化ログと同じ）
  watch: ['../process/evolution.md', '../process/evolution-archive/*.md'],
  load(watchedFiles: string[]): Timeline {
    const files = watchedFiles.map((p) => p.replaceAll('\\', '/'));
    if (!files.some((p) => p.endsWith('/process/evolution.md'))) {
      throw new Error('体制の進化ログ（docs/process/evolution.md）が見つかりません');
    }
    const entries: TimelineEntry[] = [];
    const errors: string[] = [];
    for (const path of files) {
      // サイト上のパス（/process/evolution・/process/evolution-archive/2026-09）
      const page = path.slice(path.lastIndexOf('/process/')).replace(/\.md$/, '');
      const parsed = parseEvolution(readFileSync(path, 'utf8'));
      errors.push(...parsed.errors.map((e: string) => `${page}: ${e}`));
      entries.push(
        ...parsed.entries.map((e: Omit<TimelineEntry, 'link'>) => ({
          ...e,
          link: `${page}#${githubSlug(`${e.date} ${e.title}`)}`,
        })),
      );
    }
    if (errors.length > 0) {
      throw new Error(
        `体制の進化ログの書式に誤りがある（docs/process/evolution.md「採用済み」の書式）:\n${errors.join('\n')}`,
      );
    }
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return {
      entries,
      triggers: countBy(entries, 'triggers', TRIGGERS),
      means: countBy(entries, 'means', MEANS),
      months: byMonth(entries),
    };
  },
};
