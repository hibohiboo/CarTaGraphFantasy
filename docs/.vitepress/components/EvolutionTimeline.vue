<script setup lang="ts">
// 体制の進化のタイムライン（docs/process/timeline.md）。中身はビルド時に evolution.data.ts が進化ログから集める。
// ここに状況を手で書かない
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { data } from '../evolution.data';

const adopted = computed(() => data.entries.filter((e) => e.status === '採用').length);
const rejected = computed(() => data.entries.filter((e) => e.status === '却下').length);
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
/** 月ごとに、新しい順で並べる */
const groups = computed(() => {
  const map = new Map<string, typeof data.entries>();
  for (const e of data.entries) {
    const month = e.date.slice(0, 7);
    map.set(month, [...(map.get(month) ?? []), e]);
  }
  return [...map.entries()].map(([month, entries]) => ({ month, entries }));
});
</script>

<template>
  <div class="timeline">
    <p>
      採用 {{ adopted }} 件・却下 {{ rejected }} 件。
    </p>

    <h2 id="止め方の内訳">止め方の内訳</h2>
    <p class="note">採用した項目のうち、その止め方を含む件数（1件が複数の止め方を含むことがある）。</p>
    <table>
      <tbody>
        <tr v-for="m in data.means" :key="m.name">
          <td class="nowrap">{{ m.name }}</td>
          <td class="bar-cell">
            <span class="bar" :style="{ width: `${pct(m.count, adopted)}%` }" />
          </td>
          <td class="nowrap">{{ m.count }} 件（{{ pct(m.count, adopted) }}%）</td>
        </tr>
      </tbody>
    </table>

    <h2 id="きっかけの内訳">きっかけの内訳</h2>
    <table>
      <tbody>
        <tr v-for="t in data.triggers" :key="t.name">
          <td class="nowrap">{{ t.name }}</td>
          <td class="bar-cell">
            <span class="bar trigger" :style="{ width: `${pct(t.count, adopted)}%` }" />
          </td>
          <td class="nowrap">{{ t.count }} 件（{{ pct(t.count, adopted) }}%）</td>
        </tr>
      </tbody>
    </table>

    <h2 id="月ごとの採用と機械で止めた割合">月ごとの採用と、機械で止めた割合</h2>
    <table>
      <thead>
        <tr><th>月</th><th>採用</th><th>うち止め方に機械を含む</th></tr>
      </thead>
      <tbody>
        <tr v-for="m in data.months" :key="m.month">
          <td class="nowrap">{{ m.month }}</td>
          <td>{{ m.adopted }} 件</td>
          <td>{{ m.machine }} 件（{{ pct(m.machine, m.adopted) }}%）</td>
        </tr>
      </tbody>
    </table>

    <h2 id="年表">年表</h2>
    <template v-for="g in groups" :key="g.month">
      <h3 :id="`年表-${g.month}`">{{ g.month }}</h3>
      <ul class="entries">
        <li v-for="e in g.entries" :key="e.link" :class="{ rejected: e.status === '却下' }">
          <span class="date">{{ e.date }}</span>
          <a :href="withBase(e.link)">{{ e.title }}</a>
          <span v-if="e.status === '却下'" class="tag rejected-tag">却下</span>
          <span class="tags">
            <span v-for="t in e.triggers" :key="`t-${t}`" class="tag trigger-tag">{{ t }}</span>
            <span v-for="m in e.means" :key="`m-${m}`" class="tag means-tag" :data-means="m">{{ m }}</span>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.note {
  color: var(--vp-c-text-2);
  font-size: 0.9em;
}
.nowrap {
  white-space: nowrap;
}
.bar-cell {
  width: 60%;
}
.bar {
  display: block;
  height: 0.8em;
  border-radius: 4px;
  background: var(--vp-c-brand-1);
}
.bar.trigger {
  background: var(--vp-c-tip-1);
}
.entries {
  list-style: none;
  padding: 0;
}
.entries li {
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.entries li.rejected {
  opacity: 0.7;
}
.date {
  color: var(--vp-c-text-2);
  margin-right: 0.5em;
  font-variant-numeric: tabular-nums;
}
.tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.3em;
  margin-left: 0.5em;
}
.tag {
  font-size: 0.75em;
  border-radius: 4px;
  padding: 0 0.4em;
  border: 1px solid var(--vp-c-divider);
}
.trigger-tag {
  color: var(--vp-c-text-2);
}
.means-tag[data-means='機械'] {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.rejected-tag {
  border-color: var(--vp-c-danger-1);
  color: var(--vp-c-danger-1);
}
</style>
