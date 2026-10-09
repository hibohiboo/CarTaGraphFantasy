// rules/*.json（システムのカード一覧・キャラクター作成のルール）と MSW・シードのつなぎ込み
// （docs/plans/2026-10-10-ルールとカードプールのJSON管理.md「5. 新規テストケース」）。
// 読み込みの検査そのものは packages/domain の loadRules・loadScenarioFiles の単体テストが守る。

import { basicPool, defaultAbilities } from '@cartagraph/domain/character/creation';
import type { Character } from '@cartagraph/domain/character/model';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import type { Session } from '@cartagraph/domain/session/model';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { scenarios } from '../mocks/fixtures';
import { characterCreation, systemCard, systemCards } from '../mocks/rulesFiles';
import { cardsCosting } from './rulesHelpers';

const pool = () =>
  api.get<{ basic: unknown[]; unlocked: unknown[]; budget: number; abilities: unknown }>(
    '/card-pool',
  );

const create = (cardIds: string[], o: object = {}) =>
  api.post<Character>('/characters', { name: '試し', cardIds, ...o });
const idsCosting = (target: number) => cardsCosting(target).map((c) => c.id);

const ABILITIES = defaultAbilities(characterCreation.abilities);

describe('/api/card-pool', () => {
  it('基本カードプール・CP 予算・能力値のルールは rules/ の値', async () => {
    const p = await pool();
    expect(p.basic).toEqual(basicPool(characterCreation, systemCards));
    expect(p.budget).toBe(characterCreation.cpBudget);
    expect(p.abilities).toEqual(characterCreation.abilities);
    expect(p).toMatchObject({ initialHp: characterCreation.initialHp });
  });
});

describe('POST /api/characters', () => {
  it('CP 予算をちょうど使い切ると作れ、cp は予算と使った分', async () => {
    const ch = await create(idsCosting(characterCreation.cpBudget));
    expect(ch.cp).toEqual({ total: characterCreation.cpBudget, spent: characterCreation.cpBudget });
  });

  it('CP 予算を1超えると 422', async () => {
    await expect(create(idsCosting(characterCreation.cpBudget + 1))).rejects.toMatchObject({
      status: 422,
    });
  });

  it('能力値ありで作ると HP は initialHp、なしなら HP が無い', async () => {
    const withAbilities = await create([], { abilities: ABILITIES });
    expect(withAbilities.hp).toEqual({
      current: characterCreation.initialHp,
      max: characterCreation.initialHp,
    });
    expect((await create([])).hp).toBeUndefined();
  });

  // ハンドラがデッキへ複製を入れること（E8）は、メモリ上の DB を外から見られないので、ここでは確かめられない
  // （応答は JSON を経由する）。複製は domain の pickCards（POST・PATCH が使う）と resolveGainCards の単体テスト、
  // systemCard の複製（下の describe）が守る
  it('デッキのカードはカード一覧と同じ中身', async () => {
    const [id] = idsCosting(1);
    const ch = await create([id ?? '']);
    expect(ch.deck[0]).toEqual(systemCards.find((c) => c.id === id));
  });
});

describe('PATCH /api/characters/:id', () => {
  it('存在しないカードを足そうとすると 422 で、デッキは変わらない', async () => {
    const ch = await create([]);
    await expect(
      api.patch(`/characters/${ch.id}`, { addCardIds: ['c-nope'] }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await api.get<Character>(`/characters/${ch.id}`)).deck).toEqual([]);
  });

  it('能力値を入れると HP は initialHp', async () => {
    const ch = await create([]);
    const patched = await api.patch<Character>(`/characters/${ch.id}`, { abilities: ABILITIES });
    expect(patched.hp).toEqual({
      current: characterCreation.initialHp,
      max: characterCreation.initialHp,
    });
  });
});

describe('ソロ開始', () => {
  it('作ったキャラクターの CP 予算は cpBudget', async () => {
    const s = await api.post<Session>('/scenarios/sc-village-start/start-solo', { name: '新人' });
    const driver = s.participants.find((p) => p.role === 'driver');
    const ch = await api.get<Character>(`/characters/${driver?.characterId}`);
    expect(ch.cp.total).toBe(characterCreation.cpBudget);
  });
});

describe('村はずれの一歩のお店で習うカード', () => {
  it('お店の選択肢はシステムのカードを id で指す（中身を持たない）', () => {
    const shop = byId('sc-village-start').deck.find((n) => n.id === 'vs-shop');
    const effects = shop?.cards.flatMap((c) => (c.soloEffect ? [c.soloEffect] : [])) ?? [];
    // 並ぶスキルの中身は rules/ と JSON を直せば変えられる（ライトルート）ので、ここでは書き写さない
    expect(effects.flatMap((e) => e.gainCardIds ?? []).length).toBeGreaterThan(0);
    expect(effects.flatMap((e) => e.gainCards ?? [])).toEqual([]);
  });

  it('API で依頼を1件解決して斬撃を習うと、デッキの斬撃はカード一覧と同じ中身で、一覧は汚れない', async () => {
    const s = await api.post<Session>('/scenarios/sc-village-start/start-solo', { name: '新人' });
    for (const id of [
      'vs-to-square',
      'vs-to-quest-0',
      'vs-quest-0-body',
      'vs-to-shop',
      'vs-learn-c-slash',
    ])
      await api.post(`/sessions/${s.id}/play`, { cardId: id });
    const driver = s.participants.find((p) => p.role === 'driver');
    const ch = await api.get<Character>(`/characters/${driver?.characterId}`);
    const learned = ch.deck.find((c) => c.id === 'c-slash');
    expect(learned).toEqual(systemCard('c-slash'));
    expect((await pool()).basic).toEqual(basicPool(characterCreation, systemCards));
  });
});

describe('systemCard', () => {
  it('一覧のカードの深い複製を返し、無い id は例外', () => {
    const a = systemCard('c-slash');
    expect(a).toEqual(systemCards.find((c) => c.id === 'c-slash'));
    expect(a).not.toBe(systemCards.find((c) => c.id === 'c-slash'));
    expect(() => systemCard('c-nope')).toThrow(/c-nope/);
  });
});

describe('試験官', () => {
  const villageExaminer = () =>
    byId('sc-village-start').deck.find((n) => n.id === 'vs-exam')?.autoCombat?.enemy;

  it('テスト専用の試験シナリオの敵は、村はずれの一歩の試験官と同じ中身（注記を除く）の別オブジェクト', () => {
    const exam = byId('sc-exam-no-starter').deck.flatMap((n) =>
      n.autoCombat ? [n.autoCombat] : [],
    );
    const { $comment, ...enemy } = villageExaminer() ?? {};
    expect($comment).toEqual(expect.any(String));
    expect(exam[0]?.enemy).toEqual(enemy);
    expect(exam[0]?.enemy).not.toBe(villageExaminer());
    // 入れ子まで深く複製している（試験シナリオの敵を書き換えても、村はずれの一歩の試験官を汚さない）
    expect(exam[0]?.enemy.priority).not.toBe(villageExaminer()?.priority);
    expect(exam[0]?.enemy.card).not.toBe(villageExaminer()?.card);
  });

  it('試験シナリオを組み立てたあとも、村はずれの一歩の試験官は JSON の値のまま', async () => {
    const raw = (
      import.meta.glob('../../../../scenarios/sc-village-start.json', {
        eager: true,
        import: 'default',
      }) as Record<string, Scenario>
    )['../../../../scenarios/sc-village-start.json'];
    const rawEnemy = raw?.deck.find((n) => n.id === 'vs-exam')?.autoCombat?.enemy;
    expect(villageExaminer()).toEqual(rawEnemy);
  });
});

function byId(id: string): Scenario {
  const s = scenarios.find((x) => x.id === id);
  if (!s) throw new Error(`${id} がありません`);
  return s;
}
