import { describe, expect, it } from 'vitest';
import type { ProposalStatus, Recruitment, Session } from './model';
import {
  buildParticipants,
  checkPlayFromRecruitment,
  checkResume,
  checkStart,
  defaultPartyName,
} from './start';

type Applicant = Recruitment['applicants'][number];
const jin: Applicant = {
  characterId: 'pc-jin',
  characterName: 'ジン',
  userId: 'u-me',
  playerName: 'ユウ',
};
const mio: Applicant = {
  characterId: 'pc-mio',
  characterName: 'ミオ',
  userId: 'u-kaya',
  playerName: 'カヤ',
};
const akira: Applicant = {
  characterId: 'pc-akira',
  characterName: 'アキラ',
  userId: 'u-me',
  playerName: 'ユウ',
};
const rc = (over: Partial<Recruitment> = {}) => ({
  status: 'open' as const,
  applicants: [jin, mio, akira],
  partySize: { min: 2, max: 2 },
  ...over,
});

describe('checkStart（募集からセッションを始められるか。docs/cartagraph/scenario-flow.md「全体フロー」5）', () => {
  it('受付中の募集で、応募1件をドライバーのPCに選べば開始できる（想定人数の内側なら注意なし）', () => {
    expect(
      checkStart(rc({ partySize: { min: 1, max: 1 } }), {
        characterIds: ['pc-jin'],
        driverCharacterId: 'pc-jin',
      }),
    ).toEqual({ ok: true });
  });

  it('想定人数の下限に届かなくても始められるが、注意が付く。ちょうど下限なら付かない', () => {
    expect(checkStart(rc(), { characterIds: ['pc-jin'], driverCharacterId: 'pc-jin' })).toEqual({
      ok: true,
      warning: '想定人数（2〜2人）に届いていません',
    });
    expect(
      checkStart(rc(), { characterIds: ['pc-jin', 'pc-mio'], driverCharacterId: 'pc-jin' }),
    ).toEqual({ ok: true });
  });

  it('想定人数の上限を超えても始められるが、注意が付く', () => {
    expect(
      checkStart(rc(), {
        characterIds: ['pc-jin', 'pc-mio', 'pc-akira'],
        driverCharacterId: 'pc-jin',
      }),
    ).toEqual({ ok: true, warning: '想定人数（2〜2人）を超えています' });
  });

  it('下限と上限が違うとき、ちょうど上限なら注意なし、1つ超えると注意が付く', () => {
    const wide = rc({ partySize: { min: 1, max: 2 } });
    expect(
      checkStart(wide, { characterIds: ['pc-jin', 'pc-mio'], driverCharacterId: 'pc-jin' }),
    ).toEqual({ ok: true });
    expect(
      checkStart(wide, {
        characterIds: ['pc-jin', 'pc-mio', 'pc-akira'],
        driverCharacterId: 'pc-jin',
      }),
    ).toEqual({ ok: true, warning: '想定人数（1〜2人）を超えています' });
  });

  it('開始済みの募集は始められない。PCが0件でもこのエラーが先に返る', () => {
    expect(checkStart(rc({ status: 'started' }), { characterIds: [] })).toEqual({
      ok: false,
      error: 'この募集はもう始まっています',
    });
  });

  it('PCを1件も選ばないと始められない', () => {
    expect(checkStart(rc(), { characterIds: [] })).toEqual({
      ok: false,
      error: '参加させるPCを選んでください',
    });
  });

  it('ドライバーのPCが未指定だと始められない', () => {
    expect(checkStart(rc(), { characterIds: ['pc-jin'] })).toEqual({
      ok: false,
      error: 'ドライバーのPCを選んでください',
    });
    expect(checkStart(rc(), { characterIds: ['pc-jin'], driverCharacterId: '' })).toEqual({
      ok: false,
      error: 'ドライバーのPCを選んでください',
    });
  });

  it('応募に無いPCは選べない', () => {
    expect(
      checkStart(rc(), { characterIds: ['pc-jin', 'pc-akari'], driverCharacterId: 'pc-jin' }),
    ).toEqual({ ok: false, error: '応募に無いPCが含まれています' });
  });

  it('ドライバーのPCは、選んだPCの中から選ぶ', () => {
    expect(checkStart(rc(), { characterIds: ['pc-jin'], driverCharacterId: 'pc-mio' })).toEqual({
      ok: false,
      error: 'ドライバーのPCは、参加させるPCの中から選んでください',
    });
  });

  it('同じPCを2回は選べない', () => {
    expect(
      checkStart(rc(), { characterIds: ['pc-jin', 'pc-jin'], driverCharacterId: 'pc-jin' }),
    ).toEqual({ ok: false, error: '同じPCが2回選ばれています' });
  });
});

describe('defaultPartyName', () => {
  it('ドライバーのキャラクター名から「〇〇の一行」を作る', () => {
    expect(defaultPartyName('ジン')).toBe('ジンの一行');
  });
});

describe('buildParticipants（docs/cartagraph/party-and-session.md「ドライバーとナビゲーター」）', () => {
  const at = '2026-10-03T12:00:00.000Z';
  const gm = { userId: 'u-me', name: 'ユウ' };

  it('GM・ドライバー・ナビゲーターの行を作る。GMが自分のPCでドライバーなら、同じ人がGMとドライバーの2行に載る', () => {
    expect(
      buildParticipants({ gm, selected: [jin, mio], driverCharacterId: 'pc-jin', at }),
    ).toEqual([
      { userId: 'u-me', name: 'ユウ', role: 'gm', lastSeenAt: at },
      {
        userId: 'u-me',
        name: 'ユウ',
        role: 'driver',
        characterId: 'pc-jin',
        characterName: 'ジン',
        lastSeenAt: at,
      },
      {
        userId: 'u-kaya',
        name: 'カヤ',
        role: 'navigator',
        characterId: 'pc-mio',
        characterName: 'ミオ',
        lastSeenAt: at,
      },
    ]);
  });

  it('ドライバーは選んだ順によらず、GMの次の行に来る', () => {
    const rows = buildParticipants({ gm, selected: [mio, jin], driverCharacterId: 'pc-jin', at });
    expect(rows.map((r) => r.role)).toEqual(['gm', 'driver', 'navigator']);
  });

  it('参加者の userId は、PCの所有者ではなく応募した人（借りたPC）', () => {
    // pc-akira の所有者は u-hiiragi だが、u-me が借りて応募した
    const rows = buildParticipants({
      gm: { userId: 'u-kirino', name: '霧乃' },
      selected: [akira],
      driverCharacterId: 'pc-akira',
      at,
    });
    expect(rows[1]).toMatchObject({ userId: 'u-me', role: 'driver', characterId: 'pc-akira' });
  });
});

describe('checkPlayFromRecruitment（GM 不在の募集から始められるか。docs/cartagraph/scenario-flow.md「募集とセッション」）', () => {
  const gmless = { kind: 'gmless' as const };
  const mine = { name: 'ジン', ownerId: 'u-me' };
  const cleared = {
    id: 'e-ok',
    name: '冒険者として旅立つ',
    grantsTag: '冒険者になった',
    noReplay: true,
  };

  it('GM 不在の募集で、自分の PC で、再挑戦不可でなければ始められる', () => {
    expect(checkPlayFromRecruitment(gmless, mine, { meId: 'u-me', blockedBy: null })).toEqual({
      ok: true,
    });
  });

  it('通常の募集・借りた PC・再挑戦不可は、それぞれ断る', () => {
    expect(
      checkPlayFromRecruitment({ kind: 'normal' }, mine, { meId: 'u-me', blockedBy: null }),
    ).toEqual({ ok: false, error: 'この募集は GM 不在の募集ではありません' });
    expect(
      checkPlayFromRecruitment(
        gmless,
        { name: 'アキラ', ownerId: 'u-hiiragi' },
        { meId: 'u-me', blockedBy: null },
      ),
    ).toEqual({ ok: false, error: 'GM 不在の募集では、自分が所有者の PC だけで遊べます' });
    expect(checkPlayFromRecruitment(gmless, mine, { meId: 'u-me', blockedBy: cleared })).toEqual({
      ok: false,
      error: 'ジンはこのシナリオの結末「冒険者として旅立つ」に至っているため、もう一度は遊べません',
    });
  });

  it('判定の順：通常の募集かつ借りた PC なら「GM 不在の募集でない」、借りた PC かつ再挑戦不可なら「自分の PC だけ」', () => {
    const borrowed = { name: 'アキラ', ownerId: 'u-hiiragi' };
    expect(
      checkPlayFromRecruitment({ kind: 'normal' }, borrowed, { meId: 'u-me', blockedBy: null }),
    ).toMatchObject({ error: 'この募集は GM 不在の募集ではありません' });
    expect(
      checkPlayFromRecruitment(gmless, borrowed, { meId: 'u-me', blockedBy: cleared }),
    ).toMatchObject({ error: 'GM 不在の募集では、自分が所有者の PC だけで遊べます' });
  });
});

describe('checkResume（中断したセッションを再開できるか。docs/cartagraph/party-and-session.md「中断」）', () => {
  const driver = { userId: 'u-me', role: 'driver' as const };
  const gm = { userId: 'u-kirino', role: 'gm' as const };
  const session = (
    over: {
      status?: Session['status'];
      suspendedFor?: Session['suspendedFor'];
      proposals?: { status: ProposalStatus }[];
    } = {},
  ) => ({
    status: 'suspended' as Session['status'],
    suspendedFor: 'proposal' as Session['suspendedFor'],
    participants: [gm, driver],
    proposals: [{ status: 'approved' as ProposalStatus }],
    ...over,
  });

  it('中断中で、裁定待ちの提案が無く、自分がドライバーなら再開できる', () => {
    expect(checkResume(session(), 'u-me')).toEqual({ ok: true });
  });

  it('自分がドライバーでなければ 403。GM でも再開できない', () => {
    expect(checkResume(session(), 'u-kirino')).toEqual({
      ok: false,
      status: 403,
      error: 'ドライバーだけが再開できます',
    });
  });

  it('進行中・終了なら 422', () => {
    for (const status of ['playing', 'ended'] as const)
      expect(checkResume(session({ status }), 'u-me')).toEqual({
        ok: false,
        status: 422,
        error: '中断していないセッションは再開できません',
      });
  });

  it('無反応による中断（仕様から外した）は 422', () => {
    expect(checkResume(session({ suspendedFor: 'inactivity' }), 'u-me')).toEqual({
      ok: false,
      status: 422,
      error: 'この中断の再開のしかたは、まだ決まっていません',
    });
  });

  it('裁定待ちの提案が残っていれば 422', () => {
    expect(checkResume(session({ proposals: [{ status: 'pending' }] }), 'u-me')).toEqual({
      ok: false,
      status: 422,
      error: 'GM の裁定を待っています',
    });
  });

  it('判定の順：ドライバーでなく進行中なら 403', () => {
    expect(checkResume(session({ status: 'playing' }), 'u-kirino')).toMatchObject({ status: 403 });
  });
});
