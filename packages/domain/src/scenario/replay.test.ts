import { describe, expect, it } from 'vitest';
import type { CardDef } from '../card/model';
import { endingDefSchema, endingDefShapeSchema } from './model';
import { replayBlockedBy, replayBlockedMessage } from './replay';

const endingCard = (
  scenarioId: string,
  noReplay: boolean,
  name = '冒険者として旅立つ',
): CardDef => ({
  id: `c-${scenarioId}-${name}`,
  kind: 'trait',
  name: '冒険者になった',
  tags: ['冒険者になった'],
  ending: { scenarioId, endingId: 'e-ok', endingName: name, noReplay },
});
const held = (...deck: CardDef[]) => ({ deck });

describe('replayBlockedBy（再挑戦不可。docs/cartagraph/scenario-flow.md「連作・キャンペーンの表現：結末タグ」）', {
  tags: ['rule:scenario-flow/連作・キャンペーンの表現：結末タグ'],
}, () => {
  it('そのシナリオの再挑戦不可の結末タグのカードを持つ PC は、そのカードの結末が返る', () => {
    expect(replayBlockedBy('sc-1', held(endingCard('sc-1', true)))).toEqual({
      scenarioId: 'sc-1',
      endingId: 'e-ok',
      endingName: '冒険者として旅立つ',
      noReplay: true,
    });
  });

  it('再挑戦不可でない結末のカードだけを持つ PC は null（失敗した PC は再挑戦できる）', () => {
    expect(replayBlockedBy('sc-1', held(endingCard('sc-1', false)))).toBeNull();
  });

  it('別のシナリオの再挑戦不可のカードでは止まらない', () => {
    expect(replayBlockedBy('sc-1', held(endingCard('sc-2', true)))).toBeNull();
  });

  it('同じ名前のタグだけを持つカード（ending なし）では止まらない', () => {
    const plain: CardDef = {
      id: 'c-plain',
      kind: 'trait',
      name: '冒険者になった',
      tags: ['冒険者になった'],
    };
    expect(replayBlockedBy('sc-1', held(plain))).toBeNull();
  });

  it('カードを1枚も持たない PC は null', () => {
    expect(replayBlockedBy('sc-1', held())).toBeNull();
  });

  it('止める理由の文は、PC 名と結末の名前を含む', () => {
    expect(replayBlockedMessage('ジン', { endingName: '冒険者として旅立つ' })).toBe(
      'ジンはこのシナリオの結末「冒険者として旅立つ」に至っているため、もう一度は遊べません',
    );
  });
});

describe('endingDefSchema の noReplay', {
  tags: ['rule:scenario-flow/連作・キャンペーンの表現：結末タグ'],
}, () => {
  it('noReplay: true で grantsTag の無い結末は断る。grantsTag があれば通る', () => {
    expect(endingDefSchema.safeParse({ id: 'e', name: '結末', noReplay: true }).success).toBe(
      false,
    );
    expect(
      endingDefSchema.safeParse({ id: 'e', name: '結末', grantsTag: 't', noReplay: true }).success,
    ).toBe(true);
  });

  it('noReplay: false なら grantsTag が無くても通る。真偽値でない noReplay は断る', () => {
    expect(endingDefSchema.safeParse({ id: 'e', name: '結末', noReplay: false }).success).toBe(
      true,
    );
    expect(
      endingDefSchema.safeParse({ id: 'e', name: '結末', grantsTag: 't', noReplay: 'yes' }).success,
    ).toBe(false);
  });
});

describe('endingDefShapeSchema（下書きの応答の形。docs/plans/2026-10-11-APIドキュメント.md G10）', () => {
  it('業務の検査を外すので、noReplay: true で grantsTag の無い結末も通す', () => {
    expect(endingDefShapeSchema.safeParse({ id: 'e', name: '結末', noReplay: true }).success).toBe(
      true,
    );
  });

  it('形の誤り（真偽値でない noReplay・知らないキー）は断る', () => {
    expect(endingDefShapeSchema.safeParse({ id: 'e', name: '結末', noReplay: 'yes' }).success).toBe(
      false,
    );
    expect(endingDefShapeSchema.safeParse({ id: 'e', name: '結末', x: 1 }).success).toBe(false);
  });
});
