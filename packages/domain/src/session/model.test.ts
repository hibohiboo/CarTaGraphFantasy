// 募集とセッションの zod スキーマ（docs/plans/2026-10-11-APIドキュメント.md T1）。
// API の応答の形の正なので、知らないキー・null・列挙の外を通さないことを確かめる。

import { describe, expect, it } from 'vitest';
import { recruitmentSchema, sessionSchema } from './model';

/** 必須項目だけの募集 */
const recruitment = (): Record<string, unknown> => ({
  id: 'rc-1',
  kind: 'normal',
  scenarioId: 'sc-1',
  scenarioVersion: 1,
  scenarioTitle: 'シナリオ',
  gmId: 'u-gm',
  gmName: 'GM',
  partySize: { min: 1, max: 4 },
  spaceModel: null,
  recommendedCp: 10,
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  applicants: [{ characterId: 'pc-1', characterName: 'PC', userId: 'u-1', playerName: 'PL' }],
  capacity: 4,
  status: 'open',
  excludedNodeIds: [],
});

/** 必須項目だけのセッション */
const session = (): Record<string, unknown> => ({
  id: 's-1',
  scenarioId: 'sc-1',
  scenarioVersion: 1,
  scenarioTitle: 'シナリオ',
  gmId: 'u-gm',
  gmName: 'GM',
  gmless: false,
  partyName: 'パーティー',
  status: 'playing',
  mode: 'light',
  proposalHandling: 'gm-required',
  currentScene: { index: 1, total: 3, name: '導入', path: '1' },
  participants: [{ userId: 'u-1', name: 'PL', role: 'driver', lastSeenAt: '2026-10-11T00:00:00Z' }],
  field: { gmOnly: [], plVisible: [] },
  hand: [],
  flavor: '',
  proposals: [],
  feed: [],
  lastActivityAt: '2026-10-11T00:00:00Z',
  suspendAt: '2026-10-12T00:00:00Z',
});

describe('scenarioVersion（募集・セッションが進む版番号）', () => {
  it.each([0, -1, 1.5, '1', null, undefined])('%s は募集でもセッションでも落ちる', (v) => {
    expect(recruitmentSchema.safeParse({ ...recruitment(), scenarioVersion: v }).success).toBe(
      false,
    );
    expect(sessionSchema.safeParse({ ...session(), scenarioVersion: v }).success).toBe(false);
  });

  it('1以上の整数は通る', () => {
    expect(recruitmentSchema.safeParse({ ...recruitment(), scenarioVersion: 1 }).success).toBe(
      true,
    );
    expect(sessionSchema.safeParse({ ...session(), scenarioVersion: 12 }).success).toBe(true);
  });
});

describe('recruitmentSchema', () => {
  it('必須項目だけの募集が通る', () => {
    expect(recruitmentSchema.safeParse(recruitment()).success).toBe(true);
  });

  it('省略可能な項目（note・proposalHandling）は省いても通り、null は落ちる', () => {
    expect(recruitmentSchema.safeParse({ ...recruitment(), note: 'メモ' }).success).toBe(true);
    expect(recruitmentSchema.safeParse({ ...recruitment(), note: null }).success).toBe(false);
    expect(recruitmentSchema.safeParse({ ...recruitment(), proposalHandling: null }).success).toBe(
      false,
    );
  });

  it('null を持つ項目（spaceModel）は null が通り、省くと落ちる', () => {
    const { spaceModel: _, ...without } = recruitment();
    expect(recruitmentSchema.safeParse(without).success).toBe(false);
    expect(recruitmentSchema.safeParse({ ...recruitment(), spaceModel: '2d' }).success).toBe(true);
  });

  it('知らないキーは、直下でも入れ子（応募・人数）でも落ちる', () => {
    expect(recruitmentSchema.safeParse({ ...recruitment(), extra: 1 }).success).toBe(false);
    expect(
      recruitmentSchema.safeParse({ ...recruitment(), partySize: { min: 1, max: 4, x: 1 } })
        .success,
    ).toBe(false);
    expect(
      recruitmentSchema.safeParse({
        ...recruitment(),
        applicants: [
          { characterId: 'pc-1', characterName: 'PC', userId: 'u-1', playerName: 'PL', x: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it('列挙の外（status・kind・提案の扱いの auto-resolve）は落ちる', () => {
    expect(recruitmentSchema.safeParse({ ...recruitment(), status: 'closed' }).success).toBe(false);
    expect(recruitmentSchema.safeParse({ ...recruitment(), kind: 'solo' }).success).toBe(false);
    expect(
      recruitmentSchema.safeParse({ ...recruitment(), proposalHandling: 'auto-resolve' }).success,
    ).toBe(false);
  });
});

describe('sessionSchema', () => {
  it('必須項目だけのセッションが通る', () => {
    expect(sessionSchema.safeParse(session()).success).toBe(true);
  });

  it('自動戦闘の状態と記録を持つセッションが通る', () => {
    const log = [
      {
        round: 1,
        count: 1,
        actor: 'pl',
        actorName: 'PC',
        cardName: '',
        effect: 'pass',
        rolls: [],
        amount: 0,
        plHp: 10,
        enemyHp: 8,
      },
    ];
    const s = {
      ...session(),
      autoCombat: {
        nodeId: 'n-1',
        enemyCardId: 'c-enemy',
        status: 'awaiting-priority',
        attempts: 1,
        lastResult: { outcome: 'lose', rounds: 3, log },
      },
      combatHistory: [{ nodeId: 'n-1', attempt: 1, outcome: 'lose', rounds: 3, log }],
    };
    expect(sessionSchema.safeParse(s).success).toBe(true);
  });

  it('省略可能な項目（suspendedFor・currentScene.nodeId）は null が落ちる', () => {
    expect(sessionSchema.safeParse({ ...session(), suspendedFor: null }).success).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session(),
        currentScene: { index: 1, total: 3, name: '導入', path: '1', nodeId: null },
      }).success,
    ).toBe(false);
  });

  it('知らないキーは、直下でも入れ子（シーン・場・参加者・自動戦闘の結果）でも落ちる', () => {
    expect(sessionSchema.safeParse({ ...session(), extra: 1 }).success).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session(),
        currentScene: { index: 1, total: 3, name: '導入', path: '1', x: 1 },
      }).success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({ ...session(), field: { gmOnly: [], plVisible: [], x: [] } })
        .success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session(),
        participants: [{ userId: 'u', name: 'PL', role: 'driver', lastSeenAt: '', x: 1 }],
      }).success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session(),
        autoCombat: {
          nodeId: 'n',
          enemyCardId: 'c',
          status: 'won',
          attempts: 1,
          lastResult: { outcome: 'win', rounds: 1, log: [], x: 1 },
        },
      }).success,
    ).toBe(false);
  });

  it('列挙の外（status・mode・参加者の役割・戦闘の効果）は落ちる', () => {
    expect(sessionSchema.safeParse({ ...session(), status: 'paused' }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...session(), mode: 'heavy' }).success).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session(),
        participants: [{ userId: 'u', name: 'PL', role: 'player', lastSeenAt: '' }],
      }).success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session(),
        combatHistory: [
          {
            nodeId: 'n',
            attempt: 1,
            outcome: 'win',
            rounds: 1,
            log: [
              {
                round: 1,
                count: 1,
                actor: 'pl',
                actorName: 'PC',
                cardName: '斬る',
                effect: 'poison',
                rolls: [3],
                amount: 3,
                plHp: 10,
                enemyHp: 5,
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
