// ダッシュボード（docs/index.md）の「ゴールとマイルストーン」のデータ。
// 定義の正は docs/roadmap.md の先頭（frontmatter）。進み具合はここでは持たず、ダッシュボードが要望の状態から計算する
import { createContentLoader } from 'vitepress';

export interface Milestone {
  id: string;
  title: string;
  summary: string;
}

export interface Roadmap {
  goal: string;
  milestones: Milestone[];
}

declare const data: Roadmap;

export { data };

export default createContentLoader('roadmap.md', {
  transform([page]): Roadmap {
    return { goal: page.frontmatter.goal, milestones: page.frontmatter.milestones ?? [] };
  },
});
