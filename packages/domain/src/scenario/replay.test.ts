import { describe, expect, it } from 'vitest';
import type { EndingDef } from './model';
import { endingDefSchema } from './model';
import { replayBlockedBy, replayBlockedMessage } from './replay';

const cleared: EndingDef = {
  id: 'e-ok',
  name: '冒険者として旅立つ',
  grantsTag: '冒険者になった',
  noReplay: true,
};
const failed: EndingDef = { id: 'e-ng', name: '村に戻る', grantsTag: '試験に落ちた' };
const scenario = { endings: [cleared, failed] };

describe('replayBlockedBy（再挑戦不可。docs/cartagraph/scenario-flow.md「連作・キャンペーンの表現：結末タグ」）', () => {
  it('再挑戦不可の結末の結末タグを持つ PC は、その結末が返る', () => {
    expect(replayBlockedBy(scenario, { endingTags: ['冒険者になった'] })).toEqual(cleared);
  });

  it('再挑戦不可でない結末のタグだけを持つ PC は null（失敗した PC は再挑戦できる）', () => {
    expect(replayBlockedBy(scenario, { endingTags: ['試験に落ちた'] })).toBeNull();
  });

  it('結末タグを1つも持たない PC は null', () => {
    expect(replayBlockedBy(scenario, { endingTags: [] })).toBeNull();
  });

  it('止める理由の文は、PC 名と結末の名前を含む', () => {
    expect(replayBlockedMessage('迅', cleared)).toBe(
      '迅はこのシナリオの結末「冒険者として旅立つ」に至っているため、もう一度は遊べません',
    );
  });
});

describe('endingDefSchema の noReplay', () => {
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
