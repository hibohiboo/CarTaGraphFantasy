// 応答が一覧どおりかの検査（docs/plans/2026-10-11-APIドキュメント.md T4）。値は一覧の本物の項目で確かめる。
// 対象は endpoint/check.ts だが、本物の一覧（api/endpoints.ts）を使うので、endpoint/ からは import できず api/ に置く
// （endpoint/ → api/ は依存の向きの逆。docs/process/rules/architecture.md「packages/schemas の中の置き場所」）。

import { describe, expect, it } from 'vitest';
import { checkResponse } from '../endpoint/check';
import { type Endpoint, routeKey } from '../endpoint/define';
import { endpoints } from './endpoints';

const find = (method: Endpoint['method'], path: string): Endpoint => {
  const e = endpoints.find((x) => routeKey(x) === routeKey({ method, path }));
  if (!e) throw new Error(`一覧に無い：${method} ${path}`);
  return e;
};

const me = { id: 'u-1', name: 'PL', roles: ['pl'], readRules: [], unlockedCardIds: [] };

const scenario = (endings: unknown[] = []) => ({
  id: 'sc-1',
  title: 'シナリオ',
  authorId: 'u-1',
  authorName: '作者',
  summary: '',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  partySize: { min: 1, max: 1 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'auto-resolve',
  deck: [{ id: 'n-intro', kind: 'intro', name: '導入', cards: [] }],
  endings,
  libraryStatus: 'draft',
  updatedAt: '2026-10-11T00:00:00.000Z',
});

const character = {
  id: 'pc-1',
  name: 'PC',
  ownerId: 'u-1',
  ownerName: 'PL',
  abilities: { body: 2, skill: 2, mind: 2 },
  hp: { current: 10, max: 10 },
  baseActionValue: 3,
  deck: [],
  titles: [],
  endingTags: [],
  cp: { total: 10, spent: 0 },
  createdAt: '2026-10-11T00:00:00Z',
};

/** 再挑戦不可なのに結末タグの無い結末（業務の検査にだけ通らない） */
const noReplayWithoutTag = [{ id: 'e', name: '結末', noReplay: true }];

describe('checkResponse', () => {
  it('一覧どおりの応答は誤りが無い', () => {
    expect(checkResponse(find('get', '/me'), 200, me)).toEqual([]);
    expect(checkResponse(find('post', '/characters'), 201, character)).toEqual([]);
  });

  it('一覧に無い状態コードは誤りで、メソッド・パス・状態コードが文に入る', () => {
    expect(checkResponse(find('get', '/me'), 404, { message: '無い' })).toEqual([
      'GET /me → 404：一覧に無い状態コード（一覧にあるのは 200）',
    ]);
  });

  it('201 と 200 の取り違えは、どちら向きでも誤り', () => {
    expect(checkResponse(find('post', '/characters'), 200, character)).toHaveLength(1);
    expect(checkResponse(find('get', '/characters/:id'), 201, character)).toHaveLength(1);
  });

  it('形の違う本文（列挙の外・知らないキー・入れ子の知らないキー）は誤りで、場所が文に入る', () => {
    const [roleError] = checkResponse(find('get', '/me'), 200, { ...me, roles: ['owner'] });
    expect(roleError).toMatch(/^GET \/me → 200：roles\.0 が一覧の形と違う/);
    const [extra] = checkResponse(find('get', '/me'), 200, { ...me, extra: 1 });
    expect(extra).toMatch(/^GET \/me → 200：本文 が一覧の形と違う/);
    const [nested] = checkResponse(find('post', '/characters'), 201, {
      ...character,
      hp: { current: 1, max: 1, temp: 1 },
    });
    expect(nested).toMatch(/^POST \/characters → 201：hp が一覧の形と違う/);
  });

  it('誤りは5件まで並べ、それより多ければ「ほか N 件」を足す（境界の5件と6件）', () => {
    const e = find('get', '/me');
    const five = { id: 1, name: 1, roles: 1, readRules: 1, unlockedCardIds: 1 };
    expect(checkResponse(e, 200, five)).toHaveLength(5);
    const six = checkResponse(e, 200, { ...five, extra: 1 });
    expect(six).toHaveLength(6);
    expect(six[5]).toBe('GET /me → 200：ほか 1 件');
  });

  it('本文が無い（undefined）応答は、本文そのものの誤り', () => {
    const [error] = checkResponse(find('get', '/me'), 200, undefined);
    expect(error).toMatch(/^GET \/me → 200：本文 が一覧の形と違う/);
  });

  it('失敗の応答は { message } で通り、message が無い・文字列でないと誤り', () => {
    const e = find('get', '/characters/:id');
    expect(checkResponse(e, 404, { message: 'キャラクター が見つかりません' })).toEqual([]);
    expect(checkResponse(e, 404, {})).toHaveLength(1);
    expect(checkResponse(e, 404, { message: 404 })).toHaveLength(1);
  });

  const view = (draft: unknown, publication = 'listed', changed = false) => ({
    draft,
    publication,
    changed,
  });

  it('下書きの API は業務の検査に通らない下書きも通し、公開版の API では誤り', () => {
    expect(
      checkResponse(find('get', '/scenarios/:id/draft'), 200, view(scenario(noReplayWithoutTag))),
    ).toEqual([]);
    expect(
      checkResponse(find('patch', '/scenarios/:id/draft'), 200, view(scenario(noReplayWithoutTag))),
    ).toEqual([]);
    expect(
      checkResponse(find('get', '/scenarios/:id'), 200, scenario(noReplayWithoutTag)),
    ).not.toEqual([]);
    expect(
      checkResponse(find('post', '/scenarios/:id/publish'), 200, {
        scenario: scenario(noReplayWithoutTag),
        file: { saved: false },
      }),
    ).not.toEqual([]);
  });

  it('下書きでも、形の誤り（知らないキー）と列挙の外の公開の状態は誤り', () => {
    expect(
      checkResponse(find('get', '/scenarios/:id/draft'), 200, view({ ...scenario(), extra: 1 })),
    ).not.toEqual([]);
    expect(
      checkResponse(find('get', '/scenarios/:id/draft'), 200, view(scenario(), 'published')),
    ).not.toEqual([]);
  });

  it('公開・非公開の応答のファイルの結果に null は書けない（下書きの保存はファイルを返さない）', () => {
    expect(
      checkResponse(find('post', '/scenarios/:id/publish'), 200, {
        scenario: scenario(),
        file: null,
      }),
    ).not.toEqual([]);
  });

  it('同じパスの公開版と下書きを取り違えたら誤り（GET /scenarios/:id と GET /scenarios/:id/draft）', () => {
    expect(checkResponse(find('get', '/scenarios/:id'), 200, view(scenario()))).not.toEqual([]);
    expect(checkResponse(find('get', '/scenarios/:id/draft'), 200, scenario())).not.toEqual([]);
  });
});
