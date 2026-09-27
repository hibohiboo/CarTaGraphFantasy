// MSW ハンドラ。バックエンドができるまでの代替。
// 状態はメモリ上に持ち、リロードで初期化される（永続化はしない）。

import {
  type CardDef,
  type Character,
  type HpCondition,
  type PriorityEntry,
  type Proposal,
  type Recruitment,
  type Scenario,
  type Session,
  SYSTEM_GM_ID,
  SYSTEM_GM_NAME,
} from '@cartagraph/domain';
import {
  type AutoCombatResult,
  canFight,
  resolveAutoCombat,
  validatePriority,
} from '@cartagraph/domain/autoCombat';
import {
  dealChoices,
  findDeckNode,
  planTransition,
  type TransitionPlan,
} from '@cartagraph/domain/sceneTransition';
import {
  applySoloEffect,
  grantEndingTag,
  heldCards,
  unplayableReason,
} from '@cartagraph/domain/soloVillage';
import { HttpResponse, http } from 'msw';
import { toDictionaryForm } from '../lib/japanese';
import * as fx from './fixtures';

// GMレスのソロセッションには SYSTEM_GM_ID のダミーGMを割り当てる（packages/domain）。
// 提案の自動解決の可否は Session.gmId ではなく Session.proposalHandling で判定する
// （docs/cartagraph/play-and-field.md「GMレスセッションでの提案の扱い」。シナリオ側が選ぶ設定）。
const DEFAULT_PROPOSAL_CARD_NAME = '新たな選択肢';

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

const notFound = (what: string) =>
  HttpResponse.json({ message: `${what} が見つかりません` }, { status: 404 });

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

/** 提案の採用処理（人間GMの手動承認・GMレスの自動承認の両方から呼ぶ共通ロジック） */
function resolveApprovedProposal(s: Session, p: Proposal, cardName: string) {
  p.status = 'approved';
  p.resolution = cardName;
  const card: CardDef = { id: nextId('ch'), kind: 'choice', name: cardName, tags: ['GM生成'] };
  const lastChoice = s.hand.map((c) => c.kind).lastIndexOf('choice');
  s.hand.splice(lastChoice + 1, 0, card);
  s.feed.unshift({
    id: nextId('f'),
    at: nowIso(),
    text: `${s.gmName}が提案「${p.text}」を採用`,
    cardName: card.name,
  });
  s.lastActivityAt = nowIso();
}

/**
 * proposalHandling === 'auto-resolve' のセッションでのみ呼ぶ。人間GMのような創造的な言い換えは
 * せず、提案文をtoDictionaryFormで辞書形に変換した文言をそのまま採用する（既存のGM画面
 * <GmSessionManagePage>が採用カード名の初期値に使っているのと同じ変換）。変換結果が空になる
 * 場合に備えてデフォルト文言へフォールバックする。
 */
function autoApproveProposal(s: Session, p: Proposal) {
  const cardName = toDictionaryForm(p.text).trim() || DEFAULT_PROPOSAL_CARD_NAME;
  resolveApprovedProposal(s, p, cardName);
}

/**
 * starter はシナリオの「ソロ開始時の初期装備」（docs/cartagraph/auto-combat.md「初期装備」、仮ルール）。
 * CP予算の外にある無償配布なので cp.spent は増やさない。
 */
function buildSoloCharacter(name: string, starter?: Scenario['soloStarter']): Character | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return {
    id: nextId('pc'),
    name: trimmed,
    ownerId: fx.me.id,
    ownerName: fx.me.name,
    ...(starter && {
      hp: { current: starter.hp, max: starter.hp },
      baseActionValue: starter.baseActionValue,
    }),
    deck: starter ? clone(starter.cards) : [],
    titles: [],
    endingTags: [],
    cp: { total: fx.initialCpBudget, spent: 0 },
    createdAt: nowIso(),
  };
}

function buildSoloSession(scenario: Scenario, character: Character): Session | null {
  const intro = scenario.deck.find((d) => d.kind === 'intro');
  if (!intro) return null;
  const hand = dealChoices(intro, heldCards(character, { gmOnly: [], plVisible: [] }), {
    gmId: SYSTEM_GM_ID,
  });
  return {
    id: nextId('ss'),
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    gmId: SYSTEM_GM_ID,
    gmName: SYSTEM_GM_NAME,
    partyName: character.name,
    status: 'playing',
    mode: 'light',
    proposalHandling: scenario.proposalHandling,
    currentScene: {
      index: 0,
      total: scenario.deck.length,
      name: intro.name,
      path: intro.name,
      nodeId: intro.id,
    },
    participants: [
      {
        userId: fx.me.id,
        name: fx.me.name,
        role: 'driver',
        characterId: character.id,
        characterName: character.name,
        lastSeenAt: nowIso(),
      },
    ],
    field: { gmOnly: [], plVisible: [] },
    hand,
    flavor: scenario.summary,
    proposals: [],
    feed: [{ id: nextId('f'), at: nowIso(), text: `${character.name}が${scenario.title}を始めた` }],
    lastActivityAt: nowIso(),
    suspendAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
  };
}

const RETRY_TRAIT_NAME = '再挑戦の記憶';

/** 試験の戦闘中（優先順位の設定中）か。この間は提案もプレイもできない（auto-combat.md「戦闘中の提案とプレイ」） */
const inAutoCombat = (s: Session) => s.autoCombat?.status === 'awaiting-priority';

const unprocessable = (message: string) => HttpResponse.json({ message }, { status: 422 });

const autoCombatBusy = () =>
  unprocessable('戦闘中は、戦い方（優先順位）を決めて戦闘を終えるまで他の行動はできません');

const sessionEnded = () => unprocessable('このセッションは終了しています');

/**
 * 基本操作8「次のシーンへ進む」の計算結果（planTransition）をセッションへ書き込む。
 * flavor を渡すと、移った先のシーン名だけの描写の代わりにそれを使い、自動戦闘のシーンでは
 * そのあとに相手の登場の文を続ける（solo-village.md「描写」、仮ルール）
 */
function applyTransition(s: Session, plan: Extract<TransitionPlan, { ok: true }>, flavor?: string) {
  s.currentScene = plan.currentScene;
  s.hand = [...plan.choices, ...s.hand.filter((c) => c.kind !== 'choice')];
  s.flavor = flavor || `${plan.currentScene.name}へ進んだ。`;
  s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `「${plan.currentScene.path}」へ進んだ` });
  if (plan.autoCombat && plan.currentScene.nodeId) {
    // エネミーカードはシナリオの定義をコピーして場に出す（状態タグの変更をシナリオへ波及させない）
    const enemyCard: CardDef = {
      ...clone(plan.autoCombat.enemy.card),
      id: nextId('en'),
      zone: 'pl',
    };
    s.field.plVisible.unshift(enemyCard);
    s.autoCombat = {
      nodeId: plan.currentScene.nodeId,
      enemyCardId: enemyCard.id,
      status: 'awaiting-priority',
      attempts: 0,
    };
    const appears = `${enemyCard.name}が待ち構えている。戦い方（カードの優先順位）を決めよう。`;
    s.flavor = flavor ? `${flavor} ${appears}` : appears;
  } else {
    delete s.autoCombat;
  }
  if (plan.ended) {
    s.status = 'ended';
    s.feed.unshift({
      id: nextId('f'),
      at: nowIso(),
      text: `結末「${plan.currentScene.name}」に至り、セッションが終了した`,
    });
  }
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
    HttpResponse.json({
      basic: fx.basicPool,
      unlocked: fx.unlockedPool,
      budget: fx.initialCpBudget,
    }),
  ),

  http.post('/api/characters', async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      abilities?: Character['abilities'];
      cardIds: string[];
    };
    const pool = [...fx.basicPool, ...fx.unlockedPool];
    const deck = body.cardIds
      .map((id) => pool.find((c) => c.id === id))
      .filter((c): c is CardDef => !!c);
    const spent = deck.reduce((sum, c) => sum + (c.cpCost ?? 0), 0);
    if (spent > fx.initialCpBudget) {
      // CP予算はハードな制約（docs/cartagraph/character-growth.md）
      return HttpResponse.json(
        { message: `CP予算（${fx.initialCpBudget}）を超えています` },
        { status: 422 },
      );
    }
    if (!body.name.trim())
      return HttpResponse.json({ message: '名前を入力してください' }, { status: 422 });
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

  // チュートリアル（docs/plans/2026-09-22-チュートリアル導線.md）が、Step0で作ったPCへ
  // ステップごとに段階的に反映するためのPATCH。cp.spent はdeck全体から毎回再計算する
  // （POSTハンドラと同じ予算チェックを、複数回に分けて行う形）。
  http.patch('/api/characters/:id', async ({ params, request }) => {
    const ch = db.characters.find((c) => c.id === params.id);
    if (!ch) return notFound('キャラクター');
    const body = (await request.json()) as {
      abilities?: Character['abilities'];
      addCardIds?: string[];
    };
    if (body.abilities) {
      ch.abilities = body.abilities;
      ch.hp = { current: 14, max: 14 };
    }
    if (body.addCardIds?.length) {
      const pool = [...fx.basicPool, ...fx.unlockedPool];
      const added = body.addCardIds
        .map((id) => pool.find((c) => c.id === id))
        .filter((c): c is CardDef => !!c);
      if (added.length !== body.addCardIds.length) {
        return HttpResponse.json(
          { message: '存在しないカードが指定されています' },
          { status: 422 },
        );
      }
      const nextDeck = [...ch.deck, ...added];
      const spent = nextDeck.reduce((sum, c) => sum + (c.cpCost ?? 0), 0);
      if (spent > ch.cp.total) {
        // CP予算はハードな制約（docs/cartagraph/character-growth.md）
        return HttpResponse.json(
          { message: `CP予算（${ch.cp.total}）を超えています` },
          { status: 422 },
        );
      }
      ch.deck = nextDeck;
      ch.cp = { ...ch.cp, spent };
    }
    return HttpResponse.json(ch);
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
    if (s.status === 'ended') return sessionEnded();
    if (inAutoCombat(s)) return autoCombatBusy();
    const { cardId } = (await request.json()) as { cardId: string };
    const card = s.hand.find((c) => c.id === cardId);
    if (!card) return notFound('手札のカード');
    const driver = s.participants.find((p) => p.role === 'driver');
    const character = db.characters.find((c) => c.id === driver?.characterId);
    const scenario = db.scenarios.find((x) => x.id === s.scenarioId);
    const soloGm = s.gmId === SYSTEM_GM_ID;
    // GM不在のソロの村の成長（docs/cartagraph/solo-village.md、仮ルール）。人間GMのセッションでは働かせない。
    // 使える条件の検査→効果の計算→（効果を適用した後の状態で）遷移の計算、と全部通ってから書き込む
    let grown: { character: Character; lines: string[]; achievement?: CardDef } | undefined;
    if (soloGm) {
      const reason = unplayableReason(card, character ? heldCards(character, s.field) : []);
      if (reason) return unprocessable(reason);
      if (card.soloEffect) {
        if (!character) return notFound('キャラクター');
        const r = applySoloEffect(character, card.soloEffect, scenario?.soloGrowth);
        if (!r.ok) return unprocessable(r.error);
        grown = { ...r, achievement: card.soloEffect.achievement };
      }
    }
    const actor = grown?.character ?? character;
    // 基本操作8「次のシーンへ進む」。遷移できなければセッションを一切変えずに422を返す
    let transition: Extract<TransitionPlan, { ok: true }> | undefined;
    if (card.kind === 'choice' && card.nextNodeId) {
      if (!scenario) return notFound('シナリオ');
      const field = {
        ...s.field,
        gmOnly: [...s.field.gmOnly, ...(grown?.achievement ? [grown.achievement] : [])],
      };
      const plan = planTransition(
        scenario,
        s,
        card.nextNodeId,
        actor ? heldCards(actor, field) : [],
      );
      if (!plan.ok) return unprocessable(plan.error);
      if (plan.autoCombat) {
        // 戦えないまま自動戦闘のシーンへ入ると、手札も提案も無い行き止まりになるため先に止める
        if (!actor) return notFound('キャラクター');
        const reason = canFight(actor);
        if (reason) return unprocessable(`${actor.name}は${reason}`);
      }
      transition = plan;
    }
    // ここから書き込む
    let grownFlavor: string | undefined;
    if (grown && character) {
      db.characters[db.characters.indexOf(character)] = grown.character;
      // 達成カードは GM専用ゾーンに置く。PLには見せないので feed・描写には出さない
      if (grown.achievement) s.field.gmOnly.push(clone(grown.achievement));
      // feed は新しい順。プレイの記録の下に、効果の文が上から順に並ぶようにする
      for (const line of [...grown.lines].reverse())
        s.feed.unshift({ id: nextId('f'), at: nowIso(), text: `${character.name}：${line}` });
      grownFlavor = [card.description, ...grown.lines.map((l) => `${l}。`)]
        .filter(Boolean)
        .join(' ');
    }
    const script = playScript[cardId];
    // GM不在のセッションで、次のシーンへ進まず簡易スクリプトも無い選択肢は、描写する人がいない。
    // システムがカードの説明文（無ければ定型文）を描写として返し、選んだカードだけを手札から消して
    // 同じシーンに留まる（docs/cartagraph/play-and-field.md「GMレスセッションでの選択肢の描写」）
    const selfNarrated = card.kind === 'choice' && !transition && !script && soloGm;
    if (selfNarrated) {
      s.hand = s.hand.filter((c) => c.id !== card.id);
      s.flavor =
        grownFlavor ??
        card.description ??
        `${driver?.characterName ?? 'ドライバー'}は「${card.name}」を試みた。`;
    } else if (card.kind === 'choice') {
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
    s.feed.unshift({
      id: nextId('f'),
      at: nowIso(),
      text: `${driver?.characterName ?? 'ドライバー'}が「${card.name}」をプレイ`,
      cardName: card.name,
    });
    if (transition) {
      // GM不在のソロでは、成長の効果の描写、なければ遷移カードの説明文を、移った先の描写にする（solo-village.md「描写」、仮ルール）
      // 空文字の説明文は無いものとして扱う
      applyTransition(
        s,
        transition,
        soloGm ? grownFlavor || card.description || undefined : undefined,
      );
      // 結末タグは、GM不在のソロでは結末に至った時点で即時に付ける（solo-village.md「結末タグ」、仮ルール）
      const actorNow = db.characters.find((c) => c.id === driver?.characterId);
      const granted =
        soloGm && transition.endingTag && actorNow
          ? grantEndingTag(actorNow, transition.endingTag)
          : undefined;
      // すでに持っていれば grantEndingTag は同じキャラクターを返す。そのときは「得た」と記録しない
      if (actorNow && granted && granted !== actorNow) {
        db.characters[db.characters.indexOf(actorNow)] = granted;
        s.feed.unshift({
          id: nextId('f'),
          at: nowIso(),
          text: `${actorNow.name}は結末タグ『${transition.endingTag}』を得た`,
        });
        s.flavor = `${s.flavor} 結末タグ『${transition.endingTag}』を得た。`;
      }
    }
    s.lastActivityAt = nowIso();
    return HttpResponse.json(s);
  }),

  http.post('/api/sessions/:id/proposals', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    if (s.status === 'ended') return sessionEnded();
    if (inAutoCombat(s)) return autoCombatBusy();
    if (s.proposalHandling === 'disabled')
      return HttpResponse.json(
        { message: 'このシナリオでは新たな選択肢を提案できません' },
        { status: 422 },
      );
    const { text } = (await request.json()) as { text: string };
    if (!text?.trim())
      return HttpResponse.json({ message: '提案内容を入力してください' }, { status: 422 });
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
    s.feed.unshift({
      id: nextId('f'),
      at: nowIso(),
      text: `${driver?.characterName ?? 'ドライバー'}が新たな選択肢を提案「${proposal.text}」`,
    });
    s.lastActivityAt = nowIso();
    // シナリオが「自動解決」を選んでいれば、人間GMの裁定を待たずシステムが即座に採用する
    // （docs/cartagraph/play-and-field.md「GMレスセッションでの提案の扱い」）
    if (s.proposalHandling === 'auto-resolve') autoApproveProposal(s, proposal);
    return HttpResponse.json(s, { status: 201 });
  }),

  http.post('/api/sessions/:id/proposals/:pid/approve', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    const p = s.proposals.find((x) => x.id === params.pid);
    if (!p) return notFound('提案');
    const { cardName } = (await request.json()) as { cardName: string };
    if (!cardName?.trim())
      return HttpResponse.json({ message: 'カード名を入力してください' }, { status: 422 });
    resolveApprovedProposal(s, p, cardName.trim());
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
    s.feed.unshift({
      id: nextId('f'),
      at: nowIso(),
      text: `${s.gmName}が${mode === 'dense' ? '濃密' : '軽量'}モードへ切り替えた`,
    });
    return HttpResponse.json(s);
  }),

  http.post('/api/sessions/:id/end', ({ params }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    s.status = 'ended';
    s.feed.unshift({
      id: nextId('f'),
      at: nowIso(),
      text: `${s.gmName}がセッションの終了を宣言した`,
    });
    return HttpResponse.json(s);
  }),

  // 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）。優先順位リストを受け取り、決着まで一括で解決する。
  // 判定・計算は packages/domain の resolveAutoCombat（乱数だけここで Math.random を渡す）
  http.post('/api/sessions/:id/auto-combat', async ({ params, request }) => {
    const s = findSession(String(params.id));
    if (!s) return notFound('セッション');
    if (s.status === 'ended') return sessionEnded();
    const ac = s.autoCombat;
    if (!ac) return unprocessable('いまのシーンでは自動戦闘を行いません');
    if (ac.status === 'won') return unprocessable('この戦闘には既に勝利しています');
    const scenario = db.scenarios.find((x) => x.id === s.scenarioId);
    const node = scenario && findDeckNode(scenario.deck, ac.nodeId)?.node;
    if (!node?.autoCombat) return notFound('自動戦闘のシーン');
    const driver = s.participants.find((p) => p.role === 'driver');
    const character = db.characters.find((c) => c.id === driver?.characterId);
    if (!character) return notFound('キャラクター');
    const cannot = canFight(character);
    if (cannot || !character.hp || !character.baseActionValue)
      return unprocessable(`${character.name}は${cannot ?? '戦えません'}`);

    // 本文は優先順位の各行（カードIDと使う条件）。条件の検査はドメインの validatePriority に任せる
    const body = (await request.json()) as {
      priority?: { cardId: string; when: HpCondition }[];
    } | null;
    const rows = Array.isArray(body?.priority) ? body.priority : [];
    if (rows.some((r) => typeof r !== 'object' || r === null || typeof r.cardId !== 'string'))
      return unprocessable('優先順位の行の形が正しくありません（各行はカードIDと使う条件の組）');
    const chosen = rows.map((r) => {
      const card = character.deck.find((c) => c.id === r.cardId);
      return card && { card, when: r.when };
    });
    if (chosen.some((e) => !e))
      return unprocessable('キャラクターのデッキに無いカードが含まれています');
    const priorityEntries = chosen as PriorityEntry[];
    const error = validatePriority(priorityEntries);
    if (error) return unprocessable(error);

    const { enemy, maxRounds } = node.autoCombat;
    let result: AutoCombatResult;
    try {
      result = resolveAutoCombat({
        pl: {
          name: character.name,
          maxHp: character.hp.max,
          baseActionValue: character.baseActionValue,
          priority: priorityEntries,
        },
        enemy: {
          name: enemy.card.name,
          maxHp: enemy.hp,
          baseActionValue: enemy.baseActionValue,
          priority: enemy.priority,
        },
        maxRounds,
        rng: Math.random,
      });
    } catch (e) {
      // 敵の定義などシナリオ側のデータが不正な場合。セッションは変えずに理由を返す
      return unprocessable(e instanceof Error ? e.message : '自動戦闘を解決できませんでした');
    }
    ac.attempts += 1;
    ac.lastResult = result;
    s.combatHistory = [
      ...(s.combatHistory ?? []),
      { nodeId: ac.nodeId, attempt: ac.attempts, ...result },
    ];
    const nth = `${ac.attempts}回目`;
    if (result.outcome === 'win') {
      const enemyCard = s.field.plVisible.find((c) => c.id === ac.enemyCardId);
      // HP0の敵は「戦闘不能」状態タグを付け、カードは場に残す（docs/cartagraph/combat.md）
      if (enemyCard && !enemyCard.tags.includes('戦闘不能')) enemyCard.tags.push('戦闘不能');
      ac.status = 'won';
      s.hand = [
        ...dealChoices(node, heldCards(character, s.field), s),
        ...s.hand.filter((c) => c.kind !== 'choice'),
      ];
      s.flavor = `${character.name}は${enemy.card.name}に勝利した。`;
      s.feed.unshift({
        id: nextId('f'),
        at: nowIso(),
        text: `${nth}：${character.name}は${result.rounds}ラウンドで${enemy.card.name}に勝利した`,
      });
    } else {
      s.feed.unshift({
        id: nextId('f'),
        at: nowIso(),
        text:
          result.outcome === 'lose'
            ? `${nth}：${character.name}は${result.rounds}ラウンドで${enemy.card.name}に敗れた`
            : `${nth}：${result.rounds}ラウンドで決着がつかず、${character.name}は${enemy.card.name}に敗れた`,
      });
      // 敗北（時間切れを含む）はナレーションを挟んで再挑戦へ。PLには状態タグを付けない（auto-combat.md 差分6）
      s.feed.unshift({
        id: nextId('f'),
        at: nowIso(),
        text: `${character.name}は傷を癒し、再び武具を取った`,
      });
      s.flavor = `${character.name}は傷を癒し、再び武具を取った。戦い方を見直そう。`;
      // 「再挑戦の記憶」は何度負けても1枚。ソロなので即時反映する（auto-combat.md「勝敗の扱い」）
      if (!character.deck.some((c) => c.kind === 'trait' && c.name === RETRY_TRAIT_NAME)) {
        character.deck.push({
          id: nextId('c-retry'),
          kind: 'trait',
          name: RETRY_TRAIT_NAME,
          description: '冒険者試験に一度敗れ、それでも立ち上がった記憶（自動戦闘の仮ルール）',
          tags: ['経験'],
        });
      }
    }
    s.lastActivityAt = nowIso();
    return HttpResponse.json(s);
  }),

  // 募集・応募を経由せず、1リクエストでGMレスのソロセッションを開始する
  // （docs/plans/2026-09-23-村スタート冒険者キャンペーン.md 決定事項5、3.詳細設計「GMレス基盤」）。
  // 既存のRecruitmentフローは変更しない。
  http.post('/api/scenarios/:id/start-solo', async ({ params, request }) => {
    const scenario = db.scenarios.find((x) => x.id === params.id);
    if (!scenario) return notFound('シナリオ');
    const { name } = (await request.json()) as { name: string };
    const character = buildSoloCharacter(name, scenario.soloStarter);
    if (!character)
      return HttpResponse.json({ message: '名前を入力してください' }, { status: 422 });
    const session = buildSoloSession(scenario, character);
    if (!session)
      return HttpResponse.json(
        { message: 'このシナリオはソロプレイの導入シーンを持っていません' },
        { status: 422 },
      );
    db.characters.push(character);
    db.sessions.push(session);
    return HttpResponse.json(session, { status: 201 });
  }),

  // ---------- シナリオ ----------
  http.get('/api/scenarios', ({ request }) => {
    const url = new URL(request.url);
    const mine = url.searchParams.get('mine') === '1';
    const list = mine
      ? db.scenarios.filter((s) => s.authorId === fx.me.id)
      : db.scenarios.filter((s) => s.libraryStatus === 'published');
    return HttpResponse.json(list);
  }),

  http.get('/api/scenarios/:id', ({ params }) => {
    const s = db.scenarios.find((x) => x.id === params.id);
    return s ? HttpResponse.json(s) : notFound('シナリオ');
  }),

  http.post('/api/scenarios', async ({ request }) => {
    const body = (await request.json()) as { title: string };
    if (!body.title?.trim())
      return HttpResponse.json({ message: 'タイトルを入力してください' }, { status: 422 });
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
      proposalHandling: 'gm-required',
      deck: [
        { id: nextId('d'), kind: 'intro', name: '導入', cards: [] },
        { id: nextId('d'), kind: 'ending', name: '結末', cards: [] },
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
    const body = (await request.json()) as {
      capacity: number;
      note?: string;
      excludedNodeIds?: string[];
    };
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
