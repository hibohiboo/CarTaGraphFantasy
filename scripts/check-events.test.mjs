// check-events.mjs の、設計文書どうしのドメインイベントの突き合わせ（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findEventMismatches,
  parseAggregateEvents,
  parseFlowEvents,
  parsePatternEvents,
} from './check-events.mjs';

const aggregates = [
  '# 集約',
  '## ドメインイベント',
  '| イベント | 起こす集約 | 受け取る側 |',
  '|---|---|---|',
  '| セッションを始めた | 募集（ソロ開始はシナリオから） | 作る |',
  '| セッションが終わった | セッション | 反映する |',
  '## 次の節',
  '| 無関係 | 表 | x |',
].join('\n');

const flows = [
  '| アクター | コマンド | 集約 | イベント | ポリシー |',
  '|---|---|---|---|---|',
  '| GM | 始める | 募集 | セッションを始めた | x |',
  '| PL | ソロ | （キャラクター・セッション） | キャラクターを作った・セッションを始めた | x |',
  '| GM | 終える | セッション | セッションが終わった | x |',
].join('\n');

const patterns = [
  '### イベントの種類',
  '| イベント | 種類 | 中身 | 受け取る側 |',
  '|---|---|---|---|',
  '| セッションを始めた | ドメインイベント | x | x |',
  '| ほかのイベント | ドメインイベント | x | x |',
  '### 次',
].join('\n');

describe('パーサー', () => {
  it('aggregates.md のドメインイベントの節だけを読み、集約名の括弧を落とす', () => {
    assert.deepEqual(parseAggregateEvents(aggregates), [
      { event: 'セッションを始めた', aggregate: '募集' },
      { event: 'セッションが終わった', aggregate: 'セッション' },
    ]);
  });
  it('event-flows.md の1行に複数のイベントがあれば「・」で分ける', () => {
    const names = parseFlowEvents(flows).map((f) => f.event);
    assert.deepEqual(names, [
      'セッションを始めた',
      'キャラクターを作った',
      'セッションを始めた',
      'セッションが終わった',
    ]);
  });
  it('implementation-patterns.md は「ほかのイベント」を除く', () => {
    assert.deepEqual(parsePatternEvents(patterns), ['セッションを始めた']);
  });
});

describe('findEventMismatches', () => {
  it('一致していれば空（集約が「（」で始まる行は見ない）', () => {
    assert.deepEqual(findEventMismatches({ aggregates, flows, patterns }), []);
  });
  it('aggregates.md のイベントが流れに無ければ報告する', () => {
    const f = flows.replace('セッションが終わった', 'セッションを閉じた');
    const e = findEventMismatches({ aggregates, flows: f, patterns });
    assert.equal(e.length, 1);
    assert.match(e[0], /「セッションが終わった」が event-flows\.md の流れに無い/);
  });
  it('起こす集約が違えば報告する', () => {
    const f = flows.replace('| セッション | セッションが終わった', '| 募集 | セッションが終わった');
    const e = findEventMismatches({ aggregates, flows: f, patterns });
    assert.equal(e.length, 1);
    assert.match(e[0], /起こす集約が食い違う/);
  });
  it('実装パターンのイベントがどこにも無ければ報告する', () => {
    const p = patterns.replace('| セッションを始めた', '| セッションを始めよう');
    const e = findEventMismatches({ aggregates, flows, patterns: p });
    assert.equal(e.length, 1);
    assert.match(e[0], /「セッションを始めよう」が aggregates\.md にも event-flows\.md にも無い/);
  });
});
