// scenarios/*.json の読み込みと、fixtures との関係（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// 遊べるシナリオの正は scenarios/*.json。fixtures に残る重複（プランの「重複の記録」1〜3）は、
// 統合するまでずれをここで検知する。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { scenarioSchema } from '@cartagraph/domain/scenario/model';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { examiner, cards as fixtureCards, scenarios, sessions } from '../mocks/fixtures';
import { playScript } from '../mocks/handlers';
import { scenarioFiles } from '../mocks/scenarioFiles';

const rawFiles = import.meta.glob('../../../../scenarios/*.json', {
  eager: true,
  import: 'default',
});

const byId = (id: string) => {
  const s = scenarios.find((x) => x.id === id);
  if (!s) throw new Error(`${id} がありません`);
  return s;
};

describe('scenarios/*.json の読み込み', () => {
  it('遊べる4本を id 順に読む', () => {
    expect(scenarioFiles.map((s) => s.id)).toEqual([
      'sc-corridor-after',
      'sc-galleon',
      'sc-gray-mansion',
      'sc-village-start',
    ]);
  });

  it('検査を通しても、JSON の中身は変わらない', () => {
    const raws = Object.values(rawFiles);
    expect(raws).toHaveLength(4);
    for (const raw of raws) expect(scenarioSchema.parse(raw)).toEqual(raw);
  });

  it('fixtures のシナリオは、JSON の4本・下書き・テスト専用で、id が重複しない', () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 4)).toEqual(scenarioFiles.map((s) => s.id));
    expect(ids.slice(4)).toEqual([
      'sc-draft-well',
      'sc-village-always-win',
      'sc-exam-always-win',
      'sc-exam-always-lose',
      'sc-exam-always-timeout',
      'sc-exam-no-starter',
      'sc-village-no-propose',
      'sc-no-intro',
    ]);
  });
});

describe('テスト専用の sc-village-always-win（村はずれの一歩の JSON から作る）', () => {
  it('sc-village-start との違いは、id・題名・概要・試験官の HP・広場のテスト用カードだけ', () => {
    const expected = structuredClone(byId('sc-village-start'));
    expected.id = 'sc-village-always-win';
    expected.title = '（テスト用）必ず合格する村はずれ';
    expected.summary = 'テスト専用シナリオ。';
    const exam = expected.deck.find((n) => n.id === 'vs-exam');
    if (!exam?.autoCombat) throw new Error('vs-exam がありません');
    exam.autoCombat.enemy.hp = 1;
    expected.deck
      .find((n) => n.id === 'vs-square')
      ?.cards.push({
        id: 'vw-lost',
        kind: 'choice',
        name: '（テスト用）迷い道',
        tags: [],
        nextNodeId: 'vw-nowhere',
        soloEffect: { raiseAbility: 'mind' },
      });
    expect(byId('sc-village-always-win')).toEqual(expected);
  });

  it('複製で元を汚さない（sc-village-start の試験官の HP は JSON の値のまま、広場にテスト用カードが無い）', () => {
    const start = byId('sc-village-start');
    const raw = rawFiles['../../../../scenarios/sc-village-start.json'] as typeof start;
    const rawHp = raw.deck.find((n) => n.id === 'vs-exam')?.autoCombat?.enemy.hp;
    expect(rawHp).toBeGreaterThan(1);
    expect(start.deck.find((n) => n.id === 'vs-exam')?.autoCombat?.enemy.hp).toBe(rawHp);
    expect(
      start.deck.find((n) => n.id === 'vs-square')?.cards.some((c) => c.id === 'vw-lost'),
    ).toBe(false);
  });
});

describe('fixtures に残る重複のずれ検知（統合するまで）', () => {
  it('村はずれの一歩のお店で習うスキルは、fixtures のカードと同じ', () => {
    const shop = byId('sc-village-start').deck.find((n) => n.id === 'vs-shop');
    const learned = shop?.cards.flatMap((c) => c.soloEffect?.gainCards ?? []) ?? [];
    expect(learned.map((c) => c.id)).toEqual([
      'c-slash',
      'c-heavy-blow',
      'c-quick-thrust',
      'c-first-aid',
    ]);
    const all = Object.values(fixtureCards);
    for (const c of learned) expect(c).toEqual(all.find((x) => x.id === c.id));
  });

  it('村はずれの一歩の試験官は、fixtures の examiner と同じ（注記を除く）', () => {
    const exam = byId('sc-village-start').deck.find((n) => n.id === 'vs-exam');
    const { $comment, ...enemy } = exam?.autoCombat?.enemy ?? {};
    expect($comment).toEqual(expect.any(String));
    expect(enemy).toEqual(examiner);
  });

  it('灰色館の一夜の選択肢カードは、fixtures のセッションの手札と同じで、playScript のキーは JSON に実在する', () => {
    const door = byId('sc-gray-mansion').deck.find((n) => n.id === 'd-s2');
    const hand = sessions.find((s) => s.id === 'ss-mansion')?.hand ?? [];
    for (const id of ['ch-open', 'ch-inspect', 'ch-back']) {
      expect(door?.cards.find((c) => c.id === id)).toEqual(hand.find((c) => c.id === id));
    }
    const mansionCardIds = byId('sc-gray-mansion').deck.flatMap((n) => n.cards.map((c) => c.id));
    expect(Object.keys(playScript)).toEqual(['ch-open', 'ch-inspect', 'ch-back']);
    expect(Object.keys(playScript).filter((k) => !mansionCardIds.includes(k))).toEqual([]);
  });
});

describe('MSW 経由で取得する（M1 の完成の条件2）', () => {
  it('GET /api/scenarios/:id は、scenarios/<id>.json の中身を返す（4本とも）', async () => {
    for (const [path, raw] of Object.entries(rawFiles)) {
      const id = path
        .split('/')
        .pop()
        ?.replace(/\.json$/, '');
      expect(await api.get<Scenario>(`/scenarios/${id}`)).toEqual(raw);
    }
  });

  it('公開済みの一覧は JSON の公開済み3本だけで、下書きの村はずれの一歩・涸れ井戸・テスト専用は出ない', async () => {
    const list = await api.get<Scenario[]>('/scenarios');
    expect(list.map((s) => s.id)).toEqual(['sc-corridor-after', 'sc-galleon', 'sc-gray-mansion']);
  });

  it('自分のシナリオの一覧には、JSON のガレオンと fixtures の下書きの涸れ井戸が両方出る', async () => {
    const list = await api.get<Scenario[]>('/scenarios?mine=1');
    expect(list.map((s) => s.id)).toEqual(['sc-galleon', 'sc-draft-well']);
  });
});
