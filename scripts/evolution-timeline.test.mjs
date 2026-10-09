// evolution-timeline.mjs の、進化ログの読み取りと集計（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { byMonth, countBy, MEANS, parseEvolution, TRIGGERS } from './evolution-timeline.mjs';

const log = [
  '# 開発体制の進化ログ',
  '',
  '## 候補（未評価）',
  '',
  '- [ ] 候補は読まない',
  '',
  '## 採用済み',
  '',
  '書式の説明は読まない。',
  '',
  '### 2026-09-16 CI を足した',
  '',
  '- **内容** — CI',
  '- **きっかけ** — 計画（基盤整備） ／ **止め方** — 機械（CI）',
  '',
  '### 2026-10-07 振り返りから2件を採用',
  '',
  '- **内容**',
  '  1. 一つ目',
  '   - きっかけ：人間レビュー ／ 止め方：手順・ルール（文書に書く）。あとで機械へ',
  '  2. 二つ目',
  '   - きっかけ：AI レビュー ／ 止め方：置き場所',
  '',
  '### 2026-10-01 まとめの1行で書いた項目',
  '',
  '- **きっかけ** — 1 作業中の失敗、2 人間の要望 ／ **止め方** — 1 機械（lint。CI でも回す）、2 レビュー観点',
  '',
  '## 却下',
  '',
  '### 2026-10-03 作らないと決めたもの',
  '',
  '- **きっかけ** — 作業中の振り返り ／ **止め方** — （作らない）',
].join('\n');

describe('parseEvolution', () => {
  const { entries, errors } = parseEvolution(log);

  it('採用済みと却下の項目を、新しい順に読む（候補は読まない）', () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(
      entries.map((e) => [e.date, e.status, e.title]),
      [
        ['2026-10-07', '採用', '振り返りから2件を採用'],
        ['2026-10-03', '却下', '作らないと決めたもの'],
        ['2026-10-01', '採用', 'まとめの1行で書いた項目'],
        ['2026-09-16', '採用', 'CI を足した'],
      ],
    );
  });

  it('まとめの1行と、小項目ごとの書き方の両方から、きっかけ・止め方を分類する', () => {
    const at = (date) => entries.find((e) => e.date === date);
    assert.deepEqual(at('2026-09-16').triggers, ['計画']);
    assert.deepEqual(at('2026-09-16').means, ['機械']);
    assert.deepEqual(at('2026-10-07').triggers, ['人間レビュー', 'AI レビュー']);
    assert.deepEqual(at('2026-10-01').triggers, ['人間の要望', '作業中']);
    assert.deepEqual(at('2026-10-01').means, ['機械', 'レビュー観点']);
  });

  it('止め方は最初の「。」までを読む（付け足しの「あとで機械へ」は数えない）', () => {
    assert.deepEqual(entries.find((e) => e.date === '2026-10-07').means, [
      '手順・ルール',
      '置き場所',
    ]);
  });

  it('きっかけの行が無い・分類に当たらない・見出しの形が違う項目は errors に入れる', () => {
    const bad = [
      '## 採用済み',
      '',
      '### 2026-10-08 行の無い項目',
      '',
      '- **内容** — x',
      '',
      '### 2026-10-09 分類に当たらない項目',
      '',
      '- **きっかけ** — なんとなく ／ **止め方** — 機械',
      '',
      '### 日付の無い見出し',
    ].join('\n');
    const r = parseEvolution(bad);
    assert.equal(r.errors.length, 3);
    assert.match(r.errors[0], /行が無い/);
    assert.match(r.errors[1], /分類に当たらない（なんとなく）/);
    assert.match(r.errors[2], /### 日付 タイトル/);
  });
});

describe('集計', () => {
  const { entries } = parseEvolution(log);

  it('countBy は採用した項目だけを、分類の表の順で数える（却下は数えない）', () => {
    const t = countBy(entries, 'triggers', TRIGGERS);
    assert.equal(t.find((x) => x.name === '作業中').count, 1);
    assert.deepEqual(
      countBy(entries, 'means', MEANS).map((x) => [x.name, x.count]),
      [
        ['機械', 2],
        ['レビュー観点', 1],
        ['手順・ルール', 1],
        ['置き場所', 1],
      ],
    );
  });

  it('byMonth は月ごとの採用数と、止め方に機械を含む数を古い順に返す', () => {
    assert.deepEqual(byMonth(entries), [
      { month: '2026-09', adopted: 1, machine: 1 },
      { month: '2026-10', adopted: 2, machine: 1 },
    ]);
  });
});
