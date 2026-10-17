// 案内「次にすること」の段（docs/plans/2026-10-17-シナリオ製作の導線.md T5）。
// 済みは中身から判定し、最初の未済みが「次」になる。

import type { CardDef } from '@cartagraph/domain/card/model';
import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import { describe, expect, it } from 'vitest';
import { creationSteps, nextStep } from '@/pages/creator/scenario-edit/lib/steps';

const go = (to: string): CardDef => ({
  id: `to-${to}`,
  kind: 'choice',
  name: to,
  tags: [],
  nextNodeId: to,
});
const node = (id: string, kind: DeckNode['kind'], next: string[] = []): DeckNode => ({
  id,
  kind,
  name: id,
  cards: next.map(go),
});

/** 作った直後（導入と結末のノードだけ。概要は空） */
const fresh = (o: Partial<Scenario> = {}): Scenario => ({
  id: 'sc-x',
  title: 'タイトル',
  authorId: 'u',
  authorName: 'n',
  summary: '',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  partySize: { min: 1, max: 1 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'gm-required',
  deck: [node('i', 'intro'), node('end', 'ending')],
  endings: [{ id: 'e1', name: '結末' }],
  libraryStatus: 'draft',
  updatedAt: '2026-10-17T00:00:00.000Z',
  ...o,
});
const done = (s: Scenario, publication: 'none' | 'listed' | 'unlisted' = 'none') =>
  creationSteps(s, publication).map((st) => st.done);
const next = (s: Scenario) => nextStep(creationSteps(s, 'none'))?.id;

describe('creationSteps（T5）', () => {
  it('作った直後は①だけ済み、②が次', () => {
    expect(done(fresh())).toEqual([true, false, false, false, false]);
    expect(next(fresh())).toBe('scene');
  });

  it('タイトルが空・空白（全角も）だけなら①未済み、1文字なら済み', () => {
    expect(done(fresh({ title: '' }))[0]).toBe(false);
    expect(done(fresh({ title: ' 　' }))[0]).toBe(false);
    expect(done(fresh({ title: 'あ' }))[0]).toBe(true);
    expect(next(fresh({ title: '' }))).toBe('title');
  });

  it('結末のノードを足しただけ・プール用のノードだけでは②未済み、シーンを足すと済み・③が次', () => {
    const withEnding = fresh({
      deck: [node('i', 'intro'), node('end', 'ending'), node('end2', 'ending')],
    });
    expect(done(withEnding)[1]).toBe(false);
    const pool = fresh({ deck: [node('i', 'intro'), node('n', 'npc'), node('end', 'ending')] });
    expect(done(pool)[1]).toBe(false);
    const scene = fresh({ deck: [node('i', 'intro'), node('a', 'scene'), node('end', 'ending')] });
    expect(done(scene)[1]).toBe(true);
    expect(next(scene)).toBe('connect');
  });

  it('選択肢で導入から結末のノードまでつなぐと③済み。途中で切れていれば未済み', () => {
    const cut = fresh({
      deck: [node('i', 'intro', ['a']), node('a', 'scene'), node('end', 'ending')],
    });
    expect(done(cut)[2]).toBe(false);
    const linked = fresh({
      deck: [node('i', 'intro', ['a']), node('a', 'scene', ['end']), node('end', 'ending')],
    });
    expect(done(linked)[2]).toBe(true);
    expect(next(linked)).toBe('decide');
  });

  it('概要を書くと④済み（空白だけは未済み）。途中の段を飛ばしても、最初の未済みが「次」', () => {
    expect(done(fresh({ summary: ' 　' }))[3]).toBe(false);
    const onlySummary = fresh({ summary: '紹介' });
    expect(done(onlySummary)).toEqual([true, false, false, true, false]);
    expect(next(onlySummary)).toBe('scene');
  });

  it('⑤は公開したことがあるときだけ済み。全部済みなら「次」は無い', () => {
    const all = fresh({
      summary: '紹介',
      deck: [node('i', 'intro', ['a']), node('a', 'scene', ['end']), node('end', 'ending')],
    });
    expect(done(all, 'none')[4]).toBe(false);
    expect(done(all, 'listed')[4]).toBe(true);
    expect(done(all, 'unlisted')[4]).toBe(true);
    expect(nextStep(creationSteps(all, 'listed'))).toBeUndefined();
  });
});
