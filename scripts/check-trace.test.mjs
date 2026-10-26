// check-trace.mjs（要望の trace・UC の表の画面の列と、画面・節・集約・イベントの突き合わせ）のテスト（pnpm tools:test）

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { findTraceProblems, readTraceInputs } from './check-trace.mjs';

const USE_CASES_MD = `## シナリオ製作

| ID | ユースケース | アクター | 画面 | 書き換える集約 | 起きるイベント |
|---|---|---|---|---|---|
| SC-1 | 下書きを作る | シナリオ製作者 | \`/creator/scenarios\` | シナリオ | — |
| SC-6 | 公開する | シナリオ製作者 | \`/creator/scenarios/:scenarioId\`・GM のホーム | シナリオ | シナリオを公開した |
| SC-5 | 行き止まり | GM | — | （読むだけ） | — |

## グラフ（将来）

| ID | ユースケース | アクター | 起きること |
|---|---|---|---|
| GR-1 | 構造を見る | システム製作者 | — |
`;

const base = () => ({
  backlog: [
    {
      file: 'docs/backlog/a.md',
      source:
        '---\nstatus: 完了\ntrace:\n  usecases: [SC-6, GR-1]\n  screens: [GM のホーム, /home]\n  rules: [check/判定の基本メカニズム]\n---\n',
    },
    { file: 'docs/backlog/b.md', source: '---\nstatus: 完了\ntrace:\n  none: 基盤\n---\n' },
  ],
  useCasesMd: USE_CASES_MD,
  routes: [
    { path: '/home', title: 'ホーム', group: 'pl' },
    { path: '/creator/scenarios', title: '一覧', group: 'creator' },
    { path: '/creator/scenarios/:scenarioId', title: '編集', group: 'creator' },
  ],
  missingScreens: ['GM のホーム'],
  sections: [
    { page: 'check', heading: '判定の基本メカニズム' },
    { page: 'check', heading: '設計の原則' },
  ],
  exclusions: [{ page: 'check', heading: '設計の原則', reason: '性質でない' }],
  aggregateNames: ['シナリオ', '版', '募集'],
  eventNames: ['シナリオを公開した', 'シナリオ集から外した'],
});

const problems = (mutate) => {
  const input = base();
  mutate?.(input);
  return findTraceProblems(input);
};

describe('T6: 止めるもの', () => {
  it('正しい入力は問題なし（将来の UC・まだ無い画面のラベル・none は止めない）', () => {
    assert.deepEqual(problems(), []);
  });

  it('trace が無い要望（ファイル名を出す）', () => {
    const found = problems((i) => {
      i.backlog.push({ file: 'docs/backlog/c.md', source: '---\nstatus: 完了\n---\n' });
    });
    assert.equal(found.length, 1);
    assert.match(found[0], /docs\/backlog\/c\.md.*trace が無い/);
  });

  it('trace の形の誤りは、パーサの例外の文で出る', () => {
    const found = problems((i) => {
      i.backlog[1].source = '---\ntrace:\n  none: 理由 #メモ\n---\n';
    });
    assert.equal(found.length, 1);
    assert.match(found[0], /b\.md の trace:.*#/);
  });

  it('表に無い UC', () => {
    const found = problems((i) => {
      i.backlog[0].source = i.backlog[0].source.replace('SC-6, GR-1', 'SC-6, SC-99');
    });
    assert.equal(found.length, 1);
    assert.match(found[0], /a\.md.*SC-99.*use-cases\.md の表に無い/);
  });

  it('ルートにもまだ無い画面にも無い画面', () => {
    const found = problems((i) => {
      i.backlog[0].source = i.backlog[0].source.replace('/home', '/nowhere');
    });
    assert.equal(found.length, 1);
    assert.match(found[0], /a\.md.*\/nowhere.*routes\.ts にも導線図のまだ無い画面にも無い/);
  });

  it('実在しない節と、対象外の節', () => {
    const missing = problems((i) => {
      i.backlog[0].source = i.backlog[0].source.replace('判定の基本メカニズム', '無い見出し');
    });
    assert.equal(missing.length, 1);
    assert.match(missing[0], /check\/無い見出し.*実在しない/);
    const excluded = problems((i) => {
      i.backlog[0].source = i.backlog[0].source.replace('判定の基本メカニズム', '設計の原則');
    });
    assert.equal(excluded.length, 1);
    assert.match(excluded[0], /check\/設計の原則.*対象外/);
  });

  it('UC の表の画面の列の誤り：列が無い・値が違う', () => {
    const noColumn = problems((i) => {
      i.useCasesMd = USE_CASES_MD.replace(
        '| ID | ユースケース | アクター | 画面 | 書き換える集約 | 起きるイベント |',
        '| ID | ユースケース | アクター | 書き換える集約 | 起きるイベント |',
      );
    });
    assert.ok(noColumn.some((p) => /シナリオ製作.*「画面」の列が無い/.test(p)));
    const wrong = problems((i) => {
      i.useCasesMd = USE_CASES_MD.replace('`/creator/scenarios`', '`/creator/nothing`');
    });
    assert.equal(wrong.length, 1);
    assert.match(wrong[0], /SC-1.*\/creator\/nothing/);
  });

  it('UC の表の集約・イベント・アクターの列が無い（見出しの書き直しで線が黙って消えるのを止める）', () => {
    const found = problems((i) => {
      i.useCasesMd = USE_CASES_MD.replace('| 書き換える集約 |', '| 集約 |').replace(
        '| アクター |',
        '| 担当 |',
      );
    });
    assert.ok(found.some((p) => /シナリオ製作.*「書き換える集約」の列が無い/.test(p)));
    assert.ok(found.some((p) => /シナリオ製作.*「アクター」の列が無い/.test(p)));
  });

  it('UC の表の集約・イベントの名前が aggregates.md に無い（D25）', () => {
    const agg = problems((i) => {
      i.useCasesMd = USE_CASES_MD.replace('| シナリオ | — |\n| SC-6', '| シナリオ集 | — |\n| SC-6');
    });
    assert.equal(agg.length, 1);
    assert.match(agg[0], /SC-1.*集約「シナリオ集」.*aggregates\.md/);
    const ev = problems((i) => {
      i.useCasesMd = USE_CASES_MD.replace('シナリオを公開した', '公開した');
    });
    assert.equal(ev.length, 1);
    assert.match(ev[0], /SC-6.*イベント「公開した」.*aggregates\.md/);
  });

  it('同じリストに同じ値が2回', () => {
    const found = problems((i) => {
      i.backlog[0].source = i.backlog[0].source.replace('SC-6, GR-1', 'SC-6, SC-6');
    });
    assert.equal(found.length, 1);
    assert.match(found[0], /a\.md.*SC-6.*2回/);
  });
});

describe('T7: 実物', () => {
  it('実物の docs/backlog/ と use-cases.md で問題が0件', () => {
    assert.deepEqual(findTraceProblems(readTraceInputs()), []);
  });

  it('実物の要望の数が読めている（読み落として黙って通らない）', () => {
    const inputs = readTraceInputs();
    assert.ok(inputs.backlog.length >= 40);
    assert.ok(inputs.backlog.every((b) => !b.file.endsWith('index.md')));
    assert.ok(readFileSync('docs/backlog/trace-report.md', 'utf8').includes('trace:'));
  });
});
