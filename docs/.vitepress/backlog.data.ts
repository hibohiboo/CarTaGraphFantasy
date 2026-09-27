// ダッシュボード（docs/index.md）の「要望」のデータ。docs/backlog/ の1要望1ファイルの先頭（frontmatter）を
// ビルド時に集める。書き方は docs/backlog/index.md が正
import { createContentLoader } from 'vitepress';

export type BacklogStatus = '未着手' | '検討中' | '進行中' | '判断待ち' | '完了' | '見送り';

export interface Cycle {
  name: string;
  status: BacklogStatus;
  pr?: number;
}

export interface BacklogItem {
  url: string;
  title: string;
  /** どのマイルストーンのための要望か（docs/roadmap.md の id）。無ければ空文字 */
  milestone: string;
  status: BacklogStatus;
  summary: string;
  decisions: string[];
  plans: string[];
  cycles: Cycle[];
  updated: string;
}

declare const data: BacklogItem[];

export { data };

/** 並べる順：手を動かす必要のあるものを上に */
const STATUS_ORDER: BacklogStatus[] = ['判断待ち', '進行中', '検討中', '未着手', '完了', '見送り'];

export default createContentLoader('backlog/*.md', {
  transform(raw): BacklogItem[] {
    return raw
      .filter((page) => !page.url.endsWith('/backlog/'))
      .map(({ url, frontmatter: f }) => ({
        url,
        title: f.title,
        milestone: f.milestone ?? '',
        status: f.status,
        summary: f.summary ?? '',
        decisions: f.decisions ?? [],
        plans: f.plans ?? [],
        cycles: f.cycles ?? [],
        // YAML は日付を Date として読むので、YYYY-MM-DD の文字列にそろえる
        updated:
          f.updated instanceof Date
            ? f.updated.toISOString().slice(0, 10)
            : String(f.updated ?? ''),
      }))
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          b.updated.localeCompare(a.updated),
      );
  },
});
