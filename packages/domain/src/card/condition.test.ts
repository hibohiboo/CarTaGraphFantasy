// 配る条件・使える条件の判定（docs/cartagraph/solo-village.md、仮ルール）。
// docs/plans/2026-09-27-村パート.md「5. 新規テストケース（ドメイン単体）」のうち meetsCondition の分
// （docs/plans/2026-10-03-domainのディレクトリ分割.md で soloVillage/rules.test.ts から移した）。
import { describe, expect, it } from 'vitest';
import { meetsCondition } from './condition';
import type { CardDef } from './model';

const card = (id: string, tags: string[], extra: Partial<CardDef> = {}): CardDef => ({
  id,
  kind: 'item',
  name: id,
  tags,
  ...extra,
});
const voucher = (id = 'v1') => card(id, ['引換'], { name: `${id}からの報酬` });
const slash = card('c-slash', ['戦闘スキル', '攻撃'], { kind: 'skill', name: '斬撃' });
const achievement = card('ach-boar', ['達成', '達成:猪'], {
  kind: 'info',
  name: '猪の件を片づけた',
});

describe('meetsCondition', () => {
  const held = [voucher(), slash];
  it('条件が無ければ真', () => {
    expect(meetsCondition(undefined, held)).toBe(true);
    expect(meetsCondition({}, held)).toBe(true);
  });
  it('空配列の条件は真', () => {
    expect(meetsCondition({ hasTags: [], lacksTags: [], lacksCards: [] }, [])).toBe(true);
  });
  it('hasTags：すべて持てば真、1つ欠ければ偽', () => {
    expect(meetsCondition({ hasTags: ['引換', '攻撃'] }, held)).toBe(true);
    expect(meetsCondition({ hasTags: ['引換', '回復'] }, held)).toBe(false);
  });
  it('lacksTags：1枚も無ければ真、1枚あれば偽', () => {
    expect(meetsCondition({ lacksTags: ['達成:猪'] }, held)).toBe(true);
    expect(meetsCondition({ lacksTags: ['達成:猪'] }, [...held, achievement])).toBe(false);
  });
  it('lacksCards：そのIDのカードが無ければ真、あれば偽', () => {
    expect(meetsCondition({ lacksCards: ['c-heavy-blow'] }, held)).toBe(true);
    expect(meetsCondition({ lacksCards: ['c-slash'] }, held)).toBe(false);
  });
  it('複数の項目は、すべて満たして真', () => {
    expect(meetsCondition({ hasTags: ['引換'], lacksCards: ['c-heavy-blow'] }, held)).toBe(true);
    expect(meetsCondition({ hasTags: ['引換'], lacksCards: ['c-slash'] }, held)).toBe(false);
  });
});
