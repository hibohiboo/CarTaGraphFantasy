import { describe, expect, it } from 'vitest';
import type { Recruitment } from './model';
import { buildParticipants, checkStart, defaultPartyName } from './start';

type Applicant = Recruitment['applicants'][number];
const jin: Applicant = {
  characterId: 'pc-jin',
  characterName: '迅',
  userId: 'u-me',
  playerName: 'ユウ',
};
const mio: Applicant = {
  characterId: 'pc-mio',
  characterName: '澪',
  userId: 'u-kaya',
  playerName: 'カヤ',
};
const akira: Applicant = {
  characterId: 'pc-akira',
  characterName: '彰',
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
    expect(defaultPartyName('迅')).toBe('迅の一行');
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
        characterName: '迅',
        lastSeenAt: at,
      },
      {
        userId: 'u-kaya',
        name: 'カヤ',
        role: 'navigator',
        characterId: 'pc-mio',
        characterName: '澪',
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
