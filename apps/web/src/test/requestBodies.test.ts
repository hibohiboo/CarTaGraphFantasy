// API の本文の検査（docs/plans/2026-10-10-APIスキーマの共用.md T6〜T11）。
// 本文を読む16本のエンドポイントで、形の崩れた本文を 500 にせず 422 で返し、何も変えないことを確かめる。
// 前提の検査（受付中でない・プレイ中でないなど）で止まらない状態を用意し、エンドポイントごとに期待する文まで確かめる
// （422 だけを見ると、前提の検査の 422 でも通ってしまうため）。

import type { Character } from '@cartagraph/domain/character/model';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';

const SHAPE = '本文の形が正しくありません';
const shape = (key: string) => `${SHAPE}（${key}）`;

/**
 * 本文をそのまま JSON にして送り、状態コードと文を返す（api.patch は null を {} に置き換えて送るので使わない）
 */
async function send(method: 'POST' | 'PATCH', url: string, body: unknown) {
  const res = await fetch(`/api${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, message: ((await res.json()) as { message?: string }).message };
}

/** 状態の写し（キャラクター・セッション・受付中の募集・自分のシナリオの一覧と下書き） */
const snapshot = async () => ({
  characters: await api.get<Character[]>('/characters'),
  myScenarios: await api.get<Scenario[]>('/scenarios?mine=1'),
  sessions: await api.get<Session[]>('/sessions'),
  recruitments: await api.get<Recruitment[]>('/recruitments'),
  draft: await api.get<Scenario>('/scenarios/sc-mansion-mine'),
});

/** 自分がドライバーの、プレイ中の GM 不在のセッション（ソロ開始） */
const soloSession = () =>
  api.post<Session>('/scenarios/sc-village-start/start-solo', { name: '新人' });

/** 自分がドライバーで、試験の自動戦闘の設定中のセッション */
async function examSession() {
  const s = await api.post<Session>('/scenarios/sc-exam-always-win/start-solo', { name: '新人' });
  return api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'aw-to-guild' });
}

type Row = {
  name: string;
  /** 前提を整えて、送り先の URL と HTTP メソッドを返す */
  setup: () => Promise<{ url: string; method?: 'POST' | 'PATCH' }>;
  /** 送る本文と、期待する文 */
  bodies: [unknown, string][];
};

const rows: Row[] = [
  {
    name: '1 募集への応募',
    setup: async () => ({ url: '/recruitments/rc-1/apply' }),
    bodies: [
      [null, SHAPE],
      [{ characterId: 1 }, shape('characterId')],
    ],
  },
  {
    name: '2 募集から始める',
    setup: async () => ({ url: '/recruitments/rc-mine/start' }),
    bodies: [
      [null, SHAPE],
      [{ characterIds: ['pc-jin', 1] }, '参加させるPCの指定の形が正しくありません'],
      [{ characterIds: ['pc-jin'], driverCharacterId: 'pc-jin', partyName: 1 }, shape('partyName')],
      // 以前は null を「選んでいない」に丸めていた（プランの表の「振る舞いの変化」）
      [{ characterIds: ['pc-jin'], driverCharacterId: null }, shape('driverCharacterId')],
    ],
  },
  {
    name: '3 GM 不在の募集から始める',
    setup: async () => ({ url: '/recruitments/rc-gmless/play' }),
    bodies: [
      [null, SHAPE],
      [{ characterId: 1 }, shape('characterId')],
    ],
  },
  {
    name: '4 キャラクターの作成',
    setup: async () => ({ url: '/characters' }),
    bodies: [
      [null, SHAPE],
      [{ name: 5, abilities: { body: 3, skill: 3, mind: 3 }, cardIds: [] }, shape('name')],
      [
        { name: 'a', abilities: { body: 3, skill: 3 }, cardIds: [] },
        '能力値（体・技・心）を数で送ってください',
      ],
    ],
  },
  {
    name: '5 キャラクターの更新',
    setup: async () => ({ url: '/characters/pc-jin', method: 'PATCH' }),
    bodies: [
      [null, SHAPE],
      [{ addCardIds: 'c-lantern' }, shape('addCardIds')],
      [{ hp: { current: 1, max: 1 } }, '能力値・HP・行動値は、作成したあとで変えられません'],
    ],
  },
  {
    name: '6 カードのプレイ',
    setup: async () => ({ url: `/sessions/${(await soloSession()).id}/play` }),
    bodies: [
      [null, SHAPE],
      [{ cardId: 1 }, shape('cardId')],
    ],
  },
  {
    name: '7 新たな選択肢の提案',
    setup: async () => ({ url: `/sessions/${(await soloSession()).id}/proposals` }),
    bodies: [
      [null, SHAPE],
      [{ text: 5 }, shape('text')],
    ],
  },
  {
    name: '8 提案の採用',
    setup: async () => ({ url: '/sessions/ss-galleon/proposals/pr-g1/approve' }),
    bodies: [
      [null, SHAPE],
      [{ cardName: 5 }, shape('cardName')],
      [{ cardName: '鎖を切る', nextNodeId: 1 }, '移り先の指定の形が正しくありません'],
    ],
  },
  {
    name: '9 提案の却下',
    setup: async () => ({ url: '/sessions/ss-galleon/proposals/pr-g1/reject' }),
    bodies: [
      [null, SHAPE],
      [{ reason: 5 }, shape('reason')],
      // 以前は null を「理由未記入」に丸めていた
      [{ reason: null }, shape('reason')],
    ],
  },
  {
    name: '10 描写と選択肢を配る',
    setup: async () => ({ url: '/sessions/ss-galleon/narrate' }),
    bodies: [
      [null, '描写・選択肢の指定の形が正しくありません'],
      [{ choices: [{ description: 'x' }] }, '描写・選択肢の指定の形が正しくありません'],
    ],
  },
  {
    name: '11 モードの切り替え',
    setup: async () => ({ url: '/sessions/ss-galleon/mode' }),
    bodies: [
      [null, SHAPE],
      [{ mode: 'x' }, shape('mode')],
    ],
  },
  {
    name: '12 自動戦闘',
    setup: async () => ({ url: `/sessions/${(await examSession()).id}/auto-combat` }),
    bodies: [
      [null, '優先順位の行の形が正しくありません（各行はカードIDと使う条件の組）'],
      [{ priority: 'x' }, '優先順位の行の形が正しくありません（各行はカードIDと使う条件の組）'],
    ],
  },
  {
    name: '13 ソロ開始',
    setup: async () => ({ url: '/scenarios/sc-village-start/start-solo' }),
    bodies: [
      [null, SHAPE],
      [{ name: 5 }, shape('name')],
    ],
  },
  {
    name: '14 シナリオの作成',
    setup: async () => ({ url: '/scenarios' }),
    bodies: [
      [null, SHAPE],
      [{ title: 5 }, shape('title')],
    ],
  },
  {
    name: '15 下書きの保存',
    setup: async () => ({ url: '/scenarios/sc-mansion-mine', method: 'PATCH' }),
    bodies: [
      [null, '本文はオブジェクトにしてください'],
      [5, '本文はオブジェクトにしてください'],
      [[], '本文はオブジェクトにしてください'],
    ],
  },
  {
    name: '16 募集を出す',
    setup: async () => ({ url: '/scenarios/sc-gray-mansion/recruitments' }),
    bodies: [
      [null, SHAPE],
      [{ kind: 'whatever' }, '募集の種類は通常か GM 不在のどちらかで指定してください'],
      [{ capacity: '3' }, '募集人数は1以上の整数で指定してください'],
      [{ excludedNodeIds: ['x', 1] }, '外すシーンの指定の形が正しくありません'],
      // 以前は null を「外さない」に丸め、数のメモはそのまま保存していた
      [{ capacity: 2, excludedNodeIds: null }, '外すシーンの指定の形が正しくありません'],
      [{ capacity: 2, note: 5 }, shape('note')],
      // 以前は、GM 不在の募集の募集人数・通常の募集の提案の扱いは見ずに無視していた
      [
        { kind: 'gmless', proposalHandling: 'gm-required', capacity: 'x' },
        '募集人数は1以上の整数で指定してください',
      ],
      [
        { kind: 'normal', capacity: 3, proposalHandling: 'bogus' },
        '提案の扱いは「GM が後から裁定」か「提案不可」で指定してください',
      ],
      [
        { kind: 'gmless', proposalHandling: 'auto-resolve' },
        '提案の扱いは「GM が後から裁定」か「提案不可」で指定してください',
      ],
    ],
  },
];

describe('形の崩れた本文は 500 にせず 422 で、何も変えない', () => {
  for (const row of rows)
    for (const [body, message] of row.bodies)
      it(`${row.name}：${JSON.stringify(body)} →「${message}」`, async () => {
        const { url, method = 'POST' } = await row.setup();
        const before = await snapshot();
        expect(await send(method, url, body)).toEqual({ status: 422, message });
        expect(await snapshot()).toEqual(before);
      });
});

describe('省ける項目を省いた本文は、今までどおり業務の検査まで届く（反対側）', () => {
  it.each<[string, unknown]>([
    ['本文なし', undefined],
    ['{}', {}],
  ])('2 募集から始める：%s なら、参加させる PC を選んでいない旨の 422', async (_, body) => {
    await expect(api.post('/recruitments/rc-mine/start', body)).rejects.toMatchObject({
      status: 422,
      message: '参加させるPCを選んでください',
    });
  });

  it.each<[string, unknown]>([
    ['本文なし', undefined],
    ['{}', {}],
  ])('16 募集を出す：%s なら、募集人数の 422', async (_, body) => {
    await expect(api.post('/scenarios/sc-gray-mansion/recruitments', body)).rejects.toMatchObject({
      status: 422,
      message: '募集人数は1以上の整数で指定してください',
    });
  });

  it('16 募集を出す：GM 不在の募集は募集人数を省ける。通常の募集は提案の扱いを省ける', async () => {
    const gmless = await api.post<Recruitment>('/scenarios/sc-gray-mansion/recruitments', {
      kind: 'gmless',
      proposalHandling: 'gm-required',
    });
    expect(gmless).toMatchObject({ kind: 'gmless', capacity: 0 });
    const normal = await api.post<Recruitment>('/scenarios/sc-gray-mansion/recruitments', {
      kind: 'normal',
      capacity: 1,
    });
    expect(normal).toMatchObject({ kind: 'normal', capacity: 1 });
  });

  it('12 自動戦闘：{} なら「1枚以上のカードが必要」', async () => {
    const s = await examSession();
    await expect(api.post(`/sessions/${s.id}/auto-combat`, {})).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('1枚以上'),
    });
  });

  it('9 提案の却下：理由を省くと「（理由未記入）」で却下される', async () => {
    const s = await api.post<Session>('/sessions/ss-galleon/proposals/pr-g1/reject', {});
    expect(s.proposals.find((p) => p.id === 'pr-g1')).toMatchObject({ status: 'rejected' });
    expect(JSON.stringify(s)).toContain('（理由未記入）');
  });

  it('3 GM 不在の募集から始める：characterId を省くと 404', async () => {
    await expect(api.post('/recruitments/rc-gmless/play', {})).rejects.toMatchObject({
      status: 404,
    });
  });

  it('5 キャラクターの更新：{} なら 200 で何も変わらない', async () => {
    const before = await api.get<Character>('/characters/pc-jin');
    expect(await api.patch<Character>('/characters/pc-jin', {})).toEqual(before);
  });

  it('8 提案の採用：移り先が空文字なら付けずに採用する', async () => {
    const s = await api.post<Session>('/sessions/ss-galleon/proposals/pr-g1/approve', {
      cardName: '鎖を切る',
      nextNodeId: '',
    });
    expect(s.proposals.find((p) => p.id === 'pr-g1')?.status).not.toBe('pending');
  });

  it("11 モードの切り替え：'light' に切り替わる", async () => {
    const s = await api.post<Session>('/sessions/ss-galleon/mode', { mode: 'light' });
    expect(s.mode).toBe('light');
  });

  it('15 下書きの保存：参照の切れた下書きも、今までどおり保存できる', async () => {
    const draft = await api.get<Scenario>('/scenarios/sc-mansion-mine');
    const [first] = draft.deck;
    if (!first) throw new Error('下書きにノードがありません');
    const broken = {
      deck: [
        {
          ...first,
          cards: [{ id: 'c-x', kind: 'choice', name: '迷う', tags: [], nextNodeId: 'n-nowhere' }],
        },
        ...draft.deck.slice(1),
      ],
    };
    const saved = await api.patch<{ scenario: Scenario }>('/scenarios/sc-mansion-mine', broken);
    expect(saved.scenario.deck[0]?.cards[0]?.nextNodeId).toBe('n-nowhere');
  });
});

describe('業務の検査のメッセージは変わらない（本文の形は正しく、値だけがおかしい）', () => {
  it.each<[string, () => Promise<{ url: string }>, unknown, string]>([
    [
      '7 提案が空',
      async () => ({ url: `/sessions/${(await soloSession()).id}/proposals` }),
      { text: ' ' },
      '提案内容を入力してください',
    ],
    [
      '8 カード名が空',
      async () => ({ url: '/sessions/ss-galleon/proposals/pr-g1/approve' }),
      { cardName: '' },
      'カード名を入力してください',
    ],
    [
      '4 キャラクターの名前が空',
      async () => ({ url: '/characters' }),
      { name: ' ', abilities: { body: 3, skill: 3, mind: 3 }, cardIds: [] },
      '名前を入力してください',
    ],
    [
      '13 名前が空',
      async () => ({ url: '/scenarios/sc-village-start/start-solo' }),
      { name: ' ' },
      '名前を入力してください',
    ],
    [
      '14 題名が空',
      async () => ({ url: '/scenarios' }),
      { title: '' },
      'タイトルを入力してください',
    ],
    [
      '16 募集人数が0',
      async () => ({ url: '/scenarios/sc-gray-mansion/recruitments' }),
      { capacity: 0 },
      '募集人数は1以上の整数で指定してください',
    ],
  ])('%s', async (_, setup, body, message) => {
    const { url } = await setup();
    await expect(api.post(url, body)).rejects.toMatchObject({ status: 422, message });
  });

  it('12 使う条件が3種のどれでもない：ドメインの検査の文', async () => {
    const s = await examSession();
    await expect(
      api.post(`/sessions/${s.id}/auto-combat`, {
        priority: [{ cardId: 'c-slash', when: 'sometimes' }],
      }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining('使う条件は') });
  });
});

// 15 下書きの保存だけは、今までどおり本文の検査がシナリオの存在の確認より先（存在しない id に null を送ると 422）
describe('検査の順序は変わらない', () => {
  it('存在しない募集に壊れた本文を送ると 404', async () => {
    expect((await send('POST', '/recruitments/rc-nowhere/apply', null)).status).toBe(404);
  });

  it('存在しないセッションに壊れた本文を送ると 404', async () => {
    expect((await send('POST', '/sessions/ss-nowhere/play', null)).status).toBe(404);
  });

  it('他人が GM のセッションの描写に壊れた本文を送ると 403', async () => {
    expect((await send('POST', '/sessions/ss-mansion/narrate', null)).status).toBe(403);
  });
});
