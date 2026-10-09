// 「体制の進化のタイムライン」（docs/process/timeline.md）のデータ。正は体制の進化ログ（docs/process/evolution.md）で、
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
  watch: ['../process/evolution.md'],
  load(watchedFiles: string[]): Timeline {
    const path = watchedFiles[0];
    if (!path) throw new Error('体制の進化ログ（docs/process/evolution.md）が見つかりません');
    const { entries, errors } = parseEvolution(readFileSync(path, 'utf8'));
    if (errors.length > 0) {
      throw new Error(
        `体制の進化ログの書式に誤りがある（docs/process/evolution.md「採用済み」の書式）:\n${errors.join('\n')}`,
      );
    }
    return {
      entries: entries.map((e: Omit<TimelineEntry, 'link'>) => ({
        ...e,
        link: `/process/evolution#${githubSlug(`${e.date} ${e.title}`)}`,
      })),
      triggers: countBy(entries, 'triggers', TRIGGERS),
      means: countBy(entries, 'means', MEANS),
      months: byMonth(entries),
    };
  },
};
