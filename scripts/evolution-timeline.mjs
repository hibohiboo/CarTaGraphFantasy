// 体制の進化ログ（docs/process/evolution.md）の「採用済み」「却下」を読み、タイムラインのデータにする純粋関数。
// 仕様書サイトの「体制の進化のタイムライン」（docs/process/timeline.md）がビルド時に使う（docs/.vitepress/evolution.data.ts）。
// 正は進化ログで、ここは見出しと「きっかけ」「止め方」を読み取るだけ（書き写さない）。
// テストは scripts/evolution-timeline.test.mjs（pnpm tools:test）。

/** きっかけの分類（進化ログの「採用済み」の書式の説明に合わせる）。順に当てはめ、当たったものを全部数える */
export const TRIGGERS = [
  ['人間レビュー', /人間(の(コード)?)?レビュー/],
  ['AI レビュー', /AI ?レビュー/],
  ['人間の要望', /人間の要望/],
  ['作業中', /作業中/],
  ['計画', /計画/],
  ['確認', /確認/],
];

/** 止め方の分類。「機械」がどれだけ増えたかを辿るのが目的 */
export const MEANS = [
  ['機械', /機械/],
  ['レビュー観点', /レビュー観点/],
  ['手順・ルール', /手順・ルール/],
  ['置き場所', /置き場所/],
];

/** 「## 見出し」の節を、次の「## 」まで切り出す */
function section(md, heading) {
  // ファイルの先頭の見出しも読めるよう、前に改行を足してから探す
  const text = `\n${md}`;
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) return '';
  const rest = text.slice(start + heading.length + 5);
  const end = rest.search(/\n## /);
  return end < 0 ? rest : rest.slice(0, end);
}

const classify = (text, table) => table.filter(([, re]) => re.test(text)).map(([name]) => name);

/** 括弧の外にある最初の「。」まで（括弧の中の「。」では切らない） */
function untilSentenceEnd(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '（' || c === '(') depth += 1;
    else if ((c === '）' || c === ')') && depth > 0) depth -= 1;
    else if (c === '。' && depth === 0) return text.slice(0, i);
  }
  return text;
}

/** 1件の本文から、きっかけと止め方の文を集める（まとめの1行と、小項目ごとの書き方の両方を読む） */
function tags(body) {
  const trigger = [];
  const means = [];
  for (const line of body.split('\n')) {
    const m = line.match(/きっかけ\**\s*[—：:]\s*(.*?)\s*／\s*\**止め方\**\s*[—：:]\s*(.*)$/);
    if (m) {
      trigger.push(m[1]);
      // 止め方は最初の「。」まで（後ろの付け足し「〜は候補へ」などを、やった止め方として数えない）
      means.push(untilSentenceEnd(m[2]));
    }
  }
  return { trigger: trigger.join(' '), means: means.join(' ') };
}

/**
 * 進化ログの Markdown から、新しい順の項目を返す。
 * [{ date, title, status: '採用' | '却下', triggers, means }]
 * きっかけ・止め方が無い、または分類に当たらない項目は errors に入れる（ビルドを止めるため）
 */
export function parseEvolution(md) {
  const entries = [];
  const errors = [];
  for (const [heading, status] of [
    ['採用済み', '採用'],
    ['却下', '却下'],
  ]) {
    const parts = section(md, heading)
      .split(/\n(?=### )/)
      .filter((p) => p.startsWith('### '));
    for (const part of parts) {
      const [first, ...rest] = part.split('\n');
      const h = first.match(/^### (\d{4}-\d{2}-\d{2}) (.+)$/);
      if (!h) {
        errors.push(`見出しが「### 日付 タイトル」の形でない：${first}`);
        continue;
      }
      const [, date, title] = h;
      const t = tags(rest.join('\n'));
      const triggers = classify(t.trigger, TRIGGERS);
      const means = classify(t.means, MEANS);
      if (!t.trigger) errors.push(`${date} ${title}：「きっかけ … ／ 止め方 …」の行が無い`);
      else if (triggers.length === 0)
        errors.push(`${date} ${title}：きっかけが分類に当たらない（${t.trigger}）`);
      entries.push({ date, title, status, triggers, means });
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return { entries, errors };
}

/** 分類ごとの件数（採用した項目だけ）。[{ name, count }] を表の順で */
export function countBy(entries, key, table) {
  const adopted = entries.filter((e) => e.status === '採用');
  return table.map(([name]) => ({
    name,
    count: adopted.filter((e) => e[key].includes(name)).length,
  }));
}

/** 月ごとの、採用した項目の数と、そのうち止め方に「機械」を含む数。古い順 */
export function byMonth(entries) {
  const months = new Map();
  for (const e of entries.filter((x) => x.status === '採用')) {
    const month = e.date.slice(0, 7);
    const m = months.get(month) ?? { month, adopted: 0, machine: 0 };
    m.adopted += 1;
    if (e.means.includes('機械')) m.machine += 1;
    months.set(month, m);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}
