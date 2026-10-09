// ダッシュボード（docs/index.md）の「仮ルール」のデータ。docs/provisional/ の1仮ルール1ファイルの先頭（frontmatter）を
// ビルド時に集める。書き方は docs/provisional/index.md が正。決めたらファイルを消すので、ここに並ぶのは残っている仮ルールだけ
import { createContentLoader } from 'vitepress';

export interface ProvisionalRule {
  url: string;
  title: string;
  /** 仮ルールを書いている仕様ページ（docs/ からのパス）。仕様ページに書いていない仮ルールは空 */
  spec: string[];
  /** 何を決めれば消せるか */
  decide: string;
  updated: string;
}

declare const data: ProvisionalRule[];

export { data };

export default createContentLoader('provisional/*.md', {
  transform(raw): ProvisionalRule[] {
    return raw
      .filter((page) => !page.url.endsWith('/provisional/'))
      .map(({ url, frontmatter: f }) => ({
        url,
        title: f.title,
        spec: f.spec ?? [],
        decide: f.decide ?? '',
        // YAML は日付を Date として読むので、YYYY-MM-DD の文字列にそろえる
        updated:
          f.updated instanceof Date
            ? f.updated.toISOString().slice(0, 10)
            : String(f.updated ?? ''),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  },
});
