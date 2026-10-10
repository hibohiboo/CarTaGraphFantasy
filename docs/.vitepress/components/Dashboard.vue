<script setup lang="ts">
// トップページのダッシュボード（試行。docs/backlog/dashboard.md）。
// 中身はビルド時にデータローダーが要望ファイルと各文書から集める。ここに状況を手で書かない
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { type BacklogItem, type BacklogStatus, data as backlog } from '../backlog.data';
import { data as decisions } from '../decisions.data';
import { data as provisional } from '../provisional.data';
import { data as roadmap } from '../roadmap.data';

const REPO = 'https://github.com/hibohiboo/CarTaGraphFantasy';
const planUrl = (file: string) => `${REPO}/blob/main/docs/plans/${encodeURIComponent(file)}`;
const prUrl = (pr: number) => `${REPO}/pull/${pr}`;

const BADGE: Record<BacklogStatus, 'danger' | 'warning' | 'tip' | 'info'> = {
  判断待ち: 'danger',
  進行中: 'warning',
  検討中: 'warning',
  未着手: 'info',
  完了: 'tip',
  見送り: 'info',
};

const closed = (b: BacklogItem) => b.status === '完了' || b.status === '見送り';
const openItems = computed(() => backlog.filter((b) => !closed(b)));
const closedItems = computed(() => backlog.filter(closed));
const poDecisions = computed(() =>
  backlog.flatMap((b) => b.decisions.map((d) => ({ item: b, decision: d }))),
);
/** マイルストーンごとの要望と完了数。順番は roadmap.md の並び順。いま取り組むのは、未完了の要望が残る最初のマイルストーン */
const milestones = computed(() =>
  roadmap.milestones.map((m) => {
    const items = backlog.filter((b) => b.milestone === m.id);
    const done = items.filter(closed).length;
    return { ...m, items, done, remaining: items.filter((b) => !closed(b)) };
  }),
);
const current = computed(() => milestones.value.find((m) => m.remaining.length > 0));

const withCycles = (items: BacklogItem[]) =>
  items.filter((b) => b.cycles.length > 0 || b.plans.length > 0);

/** 左の目次。読み手（PO・開発者）ごとに見出しをまとめ、件数を添える。見出しの id と揃える */
type TocEntry = { id: string; text: string; count?: number; children?: TocEntry[] };
const toc = computed<{ group: string; entries: TocEntry[] }[]>(() => [
  {
    group: '全体',
    entries: [
      {
        id: 'ゴールとマイルストーン',
        text: 'ゴールとマイルストーン',
        children: current.value
          ? [
              {
                id: '残っている要望',
                text: `「${current.value.title}」の残りの要望`,
                count: current.value.remaining.length,
              },
            ]
          : [],
      },
    ],
  },
  {
    group: 'PO 向け',
    entries: [
      {
        id: 'po-決めないといけないこと',
        text: '決めないといけないこと',
        children: [
          { id: '要望の判断待ち', text: '要望の判断待ち', count: poDecisions.value.length },
          { id: '仮ルール', text: '仮ルール', count: provisional.length },
          { id: '未解決論点', text: '未解決論点', count: decisions.openQuestions.length },
        ],
      },
      { id: 'po-要望の進み具合', text: '要望の進み具合', count: openItems.value.length },
    ],
  },
  {
    group: '開発者向け',
    entries: [
      {
        id: '開発者-要望ごとのサイクル',
        text: '要望ごとのサイクル',
        count: withCycles(openItems.value).length,
      },
      {
        id: '開発者-決めないといけないこと',
        text: '決めないといけないこと',
        children: [
          {
            id: '既知の問題の判断待ち',
            text: '既知の問題の判断待ち',
            count: decisions.knownIssues.length,
          },
          {
            id: '進化ログの未評価の候補',
            text: '進化ログの未評価の候補',
            count: decisions.processCandidates.length,
          },
        ],
      },
    ],
  },
]);
</script>

<template>
  <div class="dashboard">
    <nav class="toc" aria-label="ダッシュボードの目次">
      <details v-for="g in toc" :key="g.group" open>
        <summary>{{ g.group }}</summary>
        <ul>
          <li v-for="e in g.entries" :key="e.id">
            <a :href="`#${e.id}`">{{ e.text }}<span v-if="e.count !== undefined" class="count">{{ e.count }}</span></a>
            <ul v-if="e.children?.length">
              <li v-for="c in e.children" :key="c.id">
                <a :href="`#${c.id}`">{{ c.text }}<span v-if="c.count !== undefined" class="count">{{ c.count }}</span></a>
              </li>
            </ul>
          </li>
        </ul>
      </details>
    </nav>
    <div class="main">
      <h2 id="ゴールとマイルストーン">ゴールとマイルストーン</h2>
      <p class="goal">{{ roadmap.goal }}</p>
      <ol class="milestones">
        <li v-for="m in milestones" :key="m.id" :class="{ current: m.id === current?.id }">
          <div class="ms-head">
            <strong>{{ m.title }}</strong>
            <span v-if="m.id === current?.id" class="ms-now">いま取り組んでいる</span>
            <span v-if="m.items.length" class="ms-count">要望 {{ m.done }} / {{ m.items.length }} 完了</span>
            <span v-else class="ms-count">要望はまだ無い（前のマイルストーンの完成時に詰める）</span>
          </div>
          <progress v-if="m.items.length" :value="m.done" :max="m.items.length" />
          <p class="ms-summary">{{ m.summary }}</p>
        </li>
      </ol>
      <template v-if="current">
        <h3 id="残っている要望">「{{ current.title }}」の完成までに残っている要望</h3>
        <table>
          <tbody>
            <tr v-for="b in current.remaining" :key="b.url">
              <td><a :href="withBase(b.url)">{{ b.title }}</a></td>
              <td><Badge :type="BADGE[b.status]" :text="b.status" /></td>
              <td>{{ b.summary }}</td>
            </tr>
          </tbody>
        </table>
        <p class="plans">
          完成の条件は<a :href="withBase(`/roadmap#${current.id}`)">ロードマップの {{ current.id }}</a>を参照。
        </p>
      </template>

      <h2 id="po-決めないといけないこと">PO：決めないといけないこと</h2>

      <h3 id="要望の判断待ち">要望の判断待ち</h3>
      <ul v-if="poDecisions.length">
        <li v-for="d in poDecisions" :key="d.item.url + d.decision">
          <a :href="withBase(d.item.url)">{{ d.item.title }}</a>：{{ d.decision }}
        </li>
      </ul>
      <p v-else class="empty">いまはありません。</p>

      <h3 id="仮ルール">仮ルール（決めたら消す。残り {{ provisional.length }} 件）</h3>
      <table v-if="provisional.length">
        <thead>
          <tr><th>仮ルール</th><th>何を決めれば消せるか</th><th>仕様ページ</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in provisional" :key="p.url">
            <td><a :href="withBase(p.url)">{{ p.title }}</a></td>
            <td>{{ p.decide }}</td>
            <td>
              <a v-for="s in p.spec" :key="s" :href="withBase(`/${s.replace(/\.md$/, '')}`)" class="spec">仕様ページ</a>
              <span v-if="!p.spec.length" class="empty">（アプリだけ）</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">仮ルールは残っていません。</p>
      <p class="plans">書き方は<a :href="withBase('/provisional/')">仮ルール</a>を参照。</p>

      <h3 id="未解決論点">未解決論点（次に詰める候補）</h3>
      <ul>
        <li v-for="q in decisions.openQuestions" :key="q.title">
          <a :href="withBase(q.link)">{{ q.title }}</a>
        </li>
      </ul>

      <h2 id="po-要望の進み具合">PO：要望の進み具合</h2>
      <table>
        <thead>
          <tr><th>要望</th><th>状態</th><th>何が実現するか</th><th>更新</th></tr>
        </thead>
        <tbody>
          <tr v-for="b in openItems" :key="b.url">
            <td><a :href="withBase(b.url)">{{ b.title }}</a></td>
            <td><Badge :type="BADGE[b.status]" :text="b.status" /></td>
            <td>{{ b.summary }}</td>
            <td class="nowrap">{{ b.updated }}</td>
          </tr>
        </tbody>
      </table>
      <details>
        <summary>完了・見送り（{{ closedItems.length }}件）</summary>
        <table>
          <tbody>
            <tr v-for="b in closedItems" :key="b.url">
              <td><a :href="withBase(b.url)">{{ b.title }}</a></td>
              <td><Badge :type="BADGE[b.status]" :text="b.status" /></td>
              <td>{{ b.summary }}</td>
              <td class="nowrap">{{ b.updated }}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <h2 id="開発者-要望ごとのサイクル">開発者：要望ごとのサイクル</h2>
      <template v-for="b in withCycles(openItems)" :key="b.url">
        <h3>
          <a :href="withBase(b.url)">{{ b.title }}</a>
          <Badge :type="BADGE[b.status]" :text="b.status" />
        </h3>
        <table v-if="b.cycles.length">
          <thead>
            <tr><th>サイクル</th><th>状態</th><th>PR</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in b.cycles" :key="c.name">
              <td>{{ c.name }}</td>
              <td><Badge :type="BADGE[c.status]" :text="c.status" /></td>
              <td><a v-if="c.pr" :href="prUrl(c.pr)">#{{ c.pr }}</a></td>
            </tr>
          </tbody>
        </table>
        <p v-if="b.plans.length" class="plans">
          プラン：<template v-for="(p, i) in b.plans" :key="p"
            ><span v-if="i">、</span><a :href="planUrl(p)">{{ p.replace(/\.md$/, '') }}</a></template
          >
        </p>
      </template>
      <details>
        <summary>完了した要望のサイクル（{{ withCycles(closedItems).length }}件）</summary>
        <template v-for="b in withCycles(closedItems)" :key="b.url">
          <h4><a :href="withBase(b.url)">{{ b.title }}</a></h4>
          <table v-if="b.cycles.length">
            <tbody>
              <tr v-for="c in b.cycles" :key="c.name">
                <td>{{ c.name }}</td>
                <td><Badge :type="BADGE[c.status]" :text="c.status" /></td>
                <td><a v-if="c.pr" :href="prUrl(c.pr)">#{{ c.pr }}</a></td>
              </tr>
            </tbody>
          </table>
          <p v-if="b.plans.length" class="plans">
            プラン：<template v-for="(p, i) in b.plans" :key="p"
              ><span v-if="i">、</span><a :href="planUrl(p)">{{ p.replace(/\.md$/, '') }}</a></template
            >
          </p>
        </template>
      </details>

      <h2 id="開発者-決めないといけないこと">開発者：決めないといけないこと</h2>
      <h3 id="既知の問題の判断待ち">既知の問題の判断待ち</h3>
      <ul v-if="decisions.knownIssues.length">
        <li v-for="k in decisions.knownIssues" :key="k.title">
          <a :href="withBase(k.link)">{{ k.title }}</a>
        </li>
      </ul>
      <p v-else class="empty">いまはありません。</p>
      <h3 id="進化ログの未評価の候補">体制の進化ログの未評価の候補</h3>
      <ul v-if="decisions.processCandidates.length">
        <li v-for="c in decisions.processCandidates" :key="c.title">
          <a :href="withBase(c.link)">{{ c.title }}</a>
        </li>
      </ul>
      <p v-else class="empty">いまはありません。</p>

      <p class="note">
        このページは試行中です。中身はビルド時に
        <a :href="withBase('/backlog/')">要望（バックログ）</a>・既知の問題・未解決論点・体制の進化ログから集めています。
        見せ方の経緯は<a :href="withBase('/backlog/dashboard')">トップページのダッシュボード</a>の要望を参照。
      </p>
    </div>
  </div>
</template>

<style scoped>
.goal {
  font-size: 1.15em;
  font-weight: 600;
}
.milestones {
  list-style: none;
  padding: 0;
}
.milestones li {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
}
.milestones li.current {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 1px var(--vp-c-brand-1);
}
.ms-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: baseline;
}
.ms-now {
  color: var(--vp-c-brand-1);
  font-size: 0.85em;
  font-weight: 600;
}
.ms-count {
  color: var(--vp-c-text-2);
  font-size: 0.85em;
  margin-left: auto;
}
.milestones progress {
  width: 100%;
  height: 0.5rem;
  margin-top: 0.4rem;
}
.ms-summary {
  margin: 0.4rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.9em;
}
.dashboard {
  max-width: 1152px;
  margin: 0 auto;
}
/* 広い画面では目次を左に固定し、本文と2段に組む。狭い画面では目次を本文の上に置く */
@media (min-width: 960px) {
  .dashboard {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 2rem;
    align-items: start;
  }
  .toc {
    position: sticky;
    top: calc(var(--vp-nav-height) + 1rem);
    max-height: calc(100vh - var(--vp-nav-height) - 2rem);
    overflow-y: auto;
  }
}
.toc {
  font-size: 0.875em;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin-top: 2rem;
}
.toc details {
  margin: 0.25rem 0;
}
.toc details + details {
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 0.25rem;
}
.toc summary {
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0;
  padding: 0.25rem 0;
}
.toc ul {
  list-style: none;
  padding-left: 0;
  margin: 0.25rem 0;
}
.toc ul ul {
  padding-left: 0.9rem;
  margin: 0;
}
.toc li {
  margin: 0;
}
.toc a {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.15rem 0;
  color: var(--vp-c-text-2);
  text-decoration: none;
  line-height: 1.5;
}
.toc a:hover {
  color: var(--vp-c-brand-1);
}
.toc .count {
  flex: none;
  min-width: 1.6em;
  text-align: center;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  font-size: 0.85em;
}
.nowrap {
  white-space: nowrap;
}
.empty,
.plans,
.note {
  color: var(--vp-c-text-2);
  font-size: 0.9em;
}
.note {
  margin-top: 3rem;
}
details {
  margin: 1rem 0;
}
summary {
  cursor: pointer;
  color: var(--vp-c-text-2);
}
</style>
