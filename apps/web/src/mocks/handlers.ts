// MSW ハンドラ。バックエンドができるまでの代替。
// 状態はメモリ上に持ち、リロードで初期化される（永続化はしない）。
import { HttpResponse, http } from 'msw';
import type {
  CardDef,
  Character,
  Proposal,
  Recruitment,
  Scenario,
  Session,
} from '@cartagraph/domain';
import * as fx from './fixtures';

type Db = {
  characters: Character[];
  scenarios: Scenario[];
  recruitments: Recruitment[];
  sessions: Session[];
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let db: Db = createDb();

function createDb(): Db {
  return clone({
    characters: fx.characters,
    scenarios: fx.scenarios,
    recruitments: fx.recruitments,
    sessions: fx.sessions,
  });
}

/** テストから初期状態へ戻すために公開 */
export function resetDb(): void {
  db = createDb();
}

let seq = 1000;
const nextId = (prefix: string) => `${prefix}-${++seq}`;
const nowIso = () => new Date().toISOString();

const notFound = (what: string) => HttpResponse.json({ message: `${what} が見つかりません` }, { status: 404 });

/** 選択肢カードをプレイしたときの卓上の変化（シナリオ側の「効果」の代わりに簡易スクリプトで表現） */
const playScript: Record<string, { flavor: string; addChoices?: CardDef[]; reveal?: string }> = {
  'ch-open': {
    flavor: '扉が軋みながら開いた。冷たい空気とともに、書架の影が見える。',
    addChoices: [
      { id: 'ch-enter', kind: 'choice', name: '書庫へ入る', tags: [] },
      { id: 'ch-listen', kind: 'choice', name: '耳を澄ます', tags: [] },
    ],
    reveal: 'sc-hidden',
  },
  'ch-inspect': {
    flavor: '扉の隙間に紙が挟まっていた。震える字で「開けるな」とだけ書かれている。',
    reveal: 'info-letter',
  },
  'ch-back': {
    flavor: '一行は地下回廊へ引き返した。背後で扉がかすかに鳴る。',
    addChoices: [{ id: 'ch-return', kind: 'choice', name: 'もう一度扉へ向かう', tags: [] }],
  },
};

function findSession(id: string) {
  return db.sessions.find((s) => s.id === id);
}

export const handlers = [
  // ---------- me ----------
  http.get('/api/me', () => HttpResponse.json(fx.me)),

  // ---------- 募集（PL: セッション選択） ----------
  http.get('/api/recruitments', () => HttpResponse.json(db.recruitments)),

  http.post('/api/recruitments/:id/apply', async ({ params, request }) => {
    const rc = db.recruitments.find((r) => r.id === params.id);
    if (!rc) return notFound('募集');
    const body = (await request.json()) as { characterId: string };
    const ch = db.characters.find((c) => c.id === body.characterId);
    if (!ch) return notFound('キャラクター');
    if (rc.applicants.some((a) => a.characterId === ch.id)) {
      return HttpResponse.json({ message: 'このPCは応募済みです' }, { status: 409 });
    }
    rc.applicants.push({ characterId: ch.id, characterName: ch.name, playerName: fx.me.name });
    return HttpResponse.json(rc);
  }),

  // ---------- キャラクター ----------
  http.get('/api/characters', () => HttpResponse.json(db.characters)),

  http.get('/api/characters/:id', ({ params }) => {
    const ch = db.characters.find((c) => c.id === params.id);
    return ch ? HttpResponse.json(ch) : notFound('キャラクター');
  }),

  http.get('/api/card-pool', () =>
    HttpResponse.json({ basic: fx.basicPool, unlocked: fx.unlockedPool, budget: fx.initialCpBudget }),
  ),

  http.post('/api/characters', async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      abilities?: Character['abilities'];
      cardIds: string[];
    };
    const pool = [...fx.basicPool, ...fx.unlockedPool];
    const deck = body.cardIds.map((id) => pool.find((c) => c.id === id)).filter((c): c is CardDef => !!c);
    const spent = deck.reduce((sum, c) => sum + (c.cpCost ?? 0), 0);
    if (spent > fx.initialCpBudget) {
      // CP予算はハードな制約（docs/cartagraph/character-growth.md）
      return HttpResponse.json({ message: `CP予算（${fx.initialCpBudget}）を超えています` }, { status: 422 });
    }
    if (!body.name.trim()) return HttpResponse.json({ message: '名前を入力してください' }, { status: 422 });
    const ch: Character = {
      id: nextId('pc'),
      name: body.name.trim(),
      ownerId: fx.me.id,
      ownerName: fx.me.name,
      abilities: body.abilities,
      hp: body.abilities ? { current: 14, max: 14 } : undefined,
      deck,
      titles: [],
      endingTags: [],
      cp: { total: fx.initialCpBudget, spent },
      createdAt: nowIso(),
    };
    db.characters.push(ch);
    return HttpResponse.json(ch, { status: 201 });
  }),

  // ---------- セッション ----------
  http.get('/api/sessions', () => HttpResponse.json(db.sessions)),

  http.get('/api/sessions/:id', ({ params }) => {
    const s = findSession(String(params.id));
    return s ? HttpResponse.json(s) : notFound('セッション');
  }),

  http.post('/api/sessions/:id/play', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    const { cardId } = (await request.json()) as { cardId: string };
    const card = s.hand.find((c) => c.id === cardId);
    if (!card) return notFound('手札のカード');
    const driver = s.participants.find((p) => p.role === 'driver');
    const script = playScript[cardId];
    if (card.kind === 'choice') {
      s.hand = s.hand.filter((c) => c.kind !== 'choice');
      if (script?.addChoices) s.hand.unshift(...script.addChoices);
      s.flavor = script?.flavor ?? `「${card.name}」を選んだ。GMの描写を待っている。`;
      // 裁定待ちの提案は「今回は使われなかった」扱いにする（docs/cartagraph/play-and-field.md）
      for (const p of s.proposals) {
        if (p.status === 'pending') {
          p.status = 'approved-unused';
          p.resolution = '裁定より先に別の選択肢が選ばれたため、この提案は今回使われなかった。';
        }
      }
    } else {
      s.flavor = `${driver?.characterName ?? 'ドライバー'}は「${card.name}」を使った。`;
    }
    if (script?.reveal) {
      const idx = s.field.gmOnly.findIndex((c) => c.id === script.reveal);
      if (idx >= 0) {
        const [revealed] = s.field.gmOnly.splice(idx, 1);
        s.field.plVisible.unshift({ ...revealed, zone: 'pl' });
      }
      const fd = s.field.plVisible.find((c) => c.id === script.reveal);
      if (fd) fd.faceDown = false;
    }
    s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `${driver?.characterName ?? 'ドライバー'}が「${card.name}」をプレイ`, cardName: card.name });
    s.lastActivityAt = nowIso();
    return HttpResponse.json(s);
  }),

  http.post('/api/sessions/:id/proposals', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    const { text } = (await request.json()) as { text: string };
    if (!text?.trim()) return HttpResponse.json({ message: '提案内容を入力してください' }, { status: 422 });
    const driver = s.participants.find((p) => p.role === 'driver');
    const proposal: Proposal = {
      id: nextId('pr'),
      sessionId: s.id,
      byName: `${driver?.characterName ?? 'ドライバー'}（ドライバー）`,
      sceneName: s.currentScene.name,
      text: text.trim(),
      presentedChoices: s.hand.filter((c) => c.kind === 'choice').map((c) => c.name),
      status: 'pending',
      createdAt: nowIso(),
    };
    s.proposals.unshift(proposal);
    s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `${driver?.characterName ?? 'ドライバー'}が新たな選択肢を提案「${proposal.text}」` });
    s.lastActivityAt = nowIso();
    return HttpResponse.json(s, { status: 201 });
  }),

  http.post('/api/sessions/:id/proposals/:pid/approve', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    const p = s.proposals.find((x) => x.id === params.pid);
    if (!p) return notFound('提案');
    const { cardName } = (await request.json()) as { cardName: string };
    if (!cardName?.trim()) return HttpResponse.json({ message: 'カード名を入力してください' }, { status: 422 });
    p.status = 'approved';
    p.resolution = cardName.trim();
    const card: CardDef = { id: nextId('ch'), kind: 'choice', name: cardName.trim(), tags: ['GM生成'] };
    const lastChoice = s.hand.map((c) => c.kind).lastIndexOf('choice');
    s.hand.splice(lastChoice + 1, 0, card);
    s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `${s.gmName}が提案「${p.text}」を採用`, cardName: card.name });
    s.lastActivityAt = nowIso();
    return HttpResponse.json(s);
  }),

  http.post('/api/sessions/:id/proposals/:pid/reject', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    const p = s.proposals.find((x) => x.id === params.pid);
    if (!p) return notFound('提案');
    const { reason } = (await request.json()) as { reason: string };
    p.status = 'rejected';
    p.resolution = reason?.trim() || '（理由未記入）';
    s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `${s.gmName}が提案「${p.text}」を却下` });
    s.lastActivityAt = nowIso();
    return HttpResponse.json(s);
  }),

  http.post('/api/sessions/:id/mode', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    const { mode } = (await request.json()) as { mode: Session['mode'] };
    s.mode = mode;
    s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `${s.gmName}が${mode === 'dense' ? '濃密' : '軽量'}モードへ切り替えた` });
    return HttpResponse.json(s);
  }),

  http.post('/api/sessions/:id/end', ({ params }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    s.status = 'ended';
    s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `${s.gmName}がセッションの終了を宣言した` });
    return HttpResponse.json(s);
  }),

  // ---------- シナリオ ----------
  http.get('/api/scenarios', ({ request }) => {
    const url = new URL(request.url);
    const mine = url.searchParams.get('mine') === '1';
    const list = mine ? db.scenarios.filter((s) => s.authorId === fx.me.id) : db.scenarios.filter((s) => s.libraryStatus === 'published');
    return HttpResponse.json(list);
  }),

  http.get('/api/scenarios/:id', ({ params }) => {
    const s = db.scenarios.find((x) => x.id === params.id);
    return s ? HttpResponse.json(s) : notFound('シナリオ');
  }),

  http.post('/api/scenarios', async ({ request }) => {
    const body = (await request.json()) as { title: string };
    if (!body.title?.trim()) return HttpResponse.json({ message: 'タイトルを入力してください' }, { status: 422 });
    const s: Scenario = {
      id: nextId('sc'),
      title: body.title.trim(),
      authorId: fx.me.id,
      authorName: fx.me.name,
      summary: '',
      referenceTags: [],
      prerequisiteTags: [],
      partySize: { min: 2, max: 4 },
      spaceModel: null,
      recommendedCp: 3,
      baseCp: 3,
      deck: [
        { id: nextId('d'), kind: 'intro', name: '導入', cards: [] },
        { id: nextId('d'), kind: 'ending', name: 'エンディング', cards: [] },
      ],
      endings: [],
      libraryStatus: 'draft',
      updatedAt: nowIso(),
    };
    db.scenarios.unshift(s);
    return HttpResponse.json(s, { status: 201 });
  }),

  http.patch('/api/scenarios/:id', async ({ params, request }) => {
    const s = db.scenarios.find((x) => x.id === params.id);
    if (!s) return notFound('シナリオ');
    const patch = (await request.json()) as Partial<Scenario>;
    Object.assign(s, patch, { id: s.id, authorId: s.authorId, updatedAt: nowIso() });
    return HttpResponse.json(s);
  }),

  http.post('/api/scenarios/:id/recruitments', async ({ params, request }) => {
    const s = db.scenarios.find((x) => x.id === params.id);
    if (!s) return notFound('シナリオ');
    const body = (await request.json()) as { capacity: number; note?: string; excludedNodeIds?: string[] };
    const rc: Recruitment = {
      id: nextId('rc'),
      scenarioId: s.id,
      scenarioTitle: s.title,
      gmId: fx.me.id,
      gmName: fx.me.name,
      partySize: s.partySize,
      spaceModel: s.spaceModel,
      recommendedCp: s.recommendedCp,
      referenceTags: s.referenceTags,
      prerequisiteTags: s.prerequisiteTags,
      applicants: [],
      capacity: body.capacity,
      status: 'open',
      note: body.note,
    };
    db.recruitments.unshift(rc);
    return HttpResponse.json(rc, { status: 201 });
  }),

  // ---------- 共有ライブラリ ----------
  http.get('/api/library', () => HttpResponse.json(fx.library)),
];
