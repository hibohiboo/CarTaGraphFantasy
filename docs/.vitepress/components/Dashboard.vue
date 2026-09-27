<script setup lang="ts">
// トップページのダッシュボード（試行。docs/backlog/dashboard.md）。
// 中身はビルド時にデータローダーが要望ファイルと各文書から集める。ここに状況を手で書かない
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { type BacklogItem, type BacklogStatus, data as backlog } from '../backlog.data';
import { data as decisions } from '../decisions.data';

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
const withCycles = (items: BacklogItem[]) =>
  items.filter((b) => b.cycles.length > 0 || b.plans.length > 0);
</script>

<template>
  <div class="dashboard">
    <h2 id="po-決めないといけないこと">PO：決めないといけないこと</h2>

    <h3>要望の判断待ち</h3>
    <ul v-if="poDecisions.length">
      <li v-for="d in poDecisions" :key="d.item.url + d.decision">
        <a :href="withBase(d.item.url)">{{ d.item.title }}</a>：{{ d.decision }}
      </li>
    </ul>
    <p v-else class="empty">いまはありません。</p>

    <h3>未解決論点（次に詰める候補）</h3>
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
    <h3>既知の問題の判断待ち</h3>
    <ul v-if="decisions.knownIssues.length">
      <li v-for="k in decisions.knownIssues" :key="k.title">
        <a :href="withBase(k.link)">{{ k.title }}</a>
      </li>
    </ul>
    <p v-else class="empty">いまはありません。</p>
    <h3>体制の進化ログの未評価の候補</h3>
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
</template>

<style scoped>
.dashboard {
  max-width: 1152px;
  margin: 0 auto;
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
