// モックデータ。試作フェーズ（docs/public/preview）のダミーデータを踏襲している。
// 日時は「今」からの相対で作り、相対表示（3時間前など）が常に自然に見えるようにする。
import type {
  AutoCombatEnemy,
  CardDef,
  Character,
  CurrentUser,
  DeckNode,
  LibraryEntry,
  PriorityEntry,
  Recruitment,
  Scenario,
  Session,
} from '@cartagraph/domain';

const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 3600_000).toISOString();
const later = (hours: number) => new Date(now + hours * 3600_000).toISOString();

// ---------- カード ----------
export const cards = {
  lantern: {
    id: 'c-lantern',
    kind: 'item',
    name: '灯火のランタン',
    description: '暗い場所を照らす',
    tags: ['道具'],
    cpCost: 1,
  },
  nightEye: {
    id: 'c-night-eye',
    kind: 'trait',
    name: '夜目が利く',
    description: '暗所での判定に強い',
    tags: ['感覚'],
    cpCost: 1,
  },
  foresight: {
    id: 'c-foresight',
    kind: 'skill',
    name: '先読み',
    description: '危険な仕掛けに気づきやすい',
    tags: ['探索'],
    cpCost: 2,
  },
  lockpick: {
    id: 'c-lockpick',
    kind: 'item',
    name: '解錠具',
    description: '鍵のかかった扉や箱を開ける',
    tags: ['道具'],
    cpCost: 1,
  },
  rope: {
    id: 'c-rope',
    kind: 'item',
    name: '丈夫な縄',
    description: '登る・縛る・渡る',
    tags: ['道具'],
    cpCost: 1,
  },
  charm: {
    id: 'c-charm',
    kind: 'trait',
    name: '人当たりが良い',
    description: '対人交渉の判定に強い',
    tags: ['対人'],
    cpCost: 1,
  },
  slash: {
    id: 'c-slash',
    kind: 'skill',
    name: '斬撃',
    description: '射程1。ダイスでダメージを決める基本攻撃',
    tags: ['戦闘スキル', '攻撃'],
    cpCost: 2,
    actionCost: 3,
    range: 1,
    // 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）での効果。数値はプレイテスト前の目安
    combatEffect: { type: 'damage', dice: { count: 1, sides: 4, bonus: 0 } },
  },
  heavyBlow: {
    id: 'c-heavy-blow',
    kind: 'skill',
    name: '渾身の一撃',
    description: '射程1。コストが高いぶん大きく削る',
    tags: ['戦闘スキル', '攻撃'],
    cpCost: 3,
    actionCost: 6,
    range: 1,
    combatEffect: { type: 'damage', dice: { count: 2, sides: 4, bonus: 0 } },
  },
  guard: {
    id: 'c-guard',
    kind: 'skill',
    name: '受け流し',
    description: '味方1人へのダメージを軽減する補助',
    tags: ['戦闘スキル', '補助'],
    cpCost: 2,
    actionCost: 2,
    range: 0,
  },
  firstAid: {
    id: 'c-first-aid',
    kind: 'skill',
    name: '応急手当',
    description: '判定なしでHPを回復する',
    tags: ['戦闘スキル', '回復'],
    cpCost: 2,
    actionCost: 4,
    range: 1,
    combatEffect: { type: 'heal', dice: { count: 2, sides: 4, bonus: 2 } },
  },
  quickThrust: {
    id: 'c-quick-thrust',
    kind: 'skill',
    name: '素早い突き',
    description: '射程1。軽いぶん手数を稼げる',
    tags: ['戦闘スキル', '攻撃'],
    cpCost: 1,
    actionCost: 2,
    range: 1,
    // 数値は docs/plans/2026-09-27-村パート.md のシミュレーションで選んだプレイテスト前の目安
    combatEffect: { type: 'damage', dice: { count: 1, sides: 2, bonus: 0 } },
  },
  step: {
    id: 'c-step',
    kind: 'skill',
    name: '踏み込み',
    description: '移動カード。隣のグループへ移る',
    tags: ['戦闘スキル', '移動'],
    cpCost: 1,
    actionCost: 2,
    range: 0,
  },
  shortSword: {
    id: 'c-short-sword',
    kind: 'equipment',
    name: '短剣',
    description: '軽い刃物。斬撃の基本装備',
    tags: ['武器'],
    cpCost: 1,
  },
  seaLegs: {
    id: 'c-sea-legs',
    kind: 'trait',
    name: '航海の心得',
    description: '船上での行動に慣れている',
    tags: ['航海の心得'],
    cpCost: 1,
  },
  flameSword: {
    id: 'c-flame-sword',
    kind: 'equipment',
    name: '炎の剣',
    description: '「鉄鎖のガレオン船」の報酬カード。以後のPCもCPで選べる',
    tags: ['武器', '報酬'],
    cpCost: 4,
  },
} satisfies Record<string, CardDef>;

export const basicPool: CardDef[] = [
  cards.lantern,
  cards.nightEye,
  cards.foresight,
  cards.lockpick,
  cards.rope,
  cards.charm,
  cards.slash,
  cards.heavyBlow,
  cards.guard,
  cards.firstAid,
  cards.step,
  cards.shortSword,
];
export const unlockedPool: CardDef[] = [cards.seaLegs, cards.flameSword];
export const initialCpBudget = 5;

// ---------- ユーザー ----------
export const me: CurrentUser = {
  id: 'u-me',
  name: 'ユウ',
  roles: ['pl', 'gm', 'creator', 'admin'],
  readRules: ['how-to-play'],
  unlockedCardIds: unlockedPool.map((c) => c.id),
};

// ---------- キャラクター ----------
export const characters: Character[] = [
  {
    id: 'pc-jin',
    name: '迅',
    ownerId: 'u-me',
    ownerName: 'ユウ',
    abilities: { body: 3, skill: 4, mind: 2 },
    hp: { current: 16, max: 16 },
    deck: [cards.lantern, cards.nightEye, cards.foresight],
    titles: ['夜歩き'],
    endingTags: [],
    cp: { total: 5, spent: 4 },
    createdAt: ago(24 * 30),
  },
  {
    id: 'pc-akari',
    name: '灯',
    ownerId: 'u-me',
    ownerName: 'ユウ',
    deck: [cards.charm, cards.rope],
    titles: [],
    endingTags: ['灯りの回廊を経験'],
    cp: { total: 5, spent: 2 },
    createdAt: ago(24 * 12),
  },
  {
    id: 'pc-akira',
    name: '彰',
    ownerId: 'u-hiiragi',
    ownerName: '柊',
    abilities: { body: 4, skill: 2, mind: 3 },
    hp: { current: 20, max: 20 },
    baseActionValue: 13,
    deck: [cards.slash, cards.heavyBlow, cards.shortSword, cards.step],
    titles: ['一匹狼'],
    endingTags: [],
    cp: { total: 8, spent: 7 },
    createdAt: ago(24 * 60),
  },
  {
    id: 'pc-mio',
    name: '澪',
    ownerId: 'u-kaya',
    ownerName: 'カヤ',
    abilities: { body: 2, skill: 3, mind: 5 },
    hp: { current: 12, max: 14 },
    baseActionValue: 10,
    deck: [cards.firstAid, cards.guard, cards.seaLegs],
    titles: ['クール'],
    endingTags: [],
    cp: { total: 8, spent: 5 },
    createdAt: ago(24 * 45),
  },
];

// ---------- シナリオ ----------
const openDoor: CardDef = {
  id: 'ch-open',
  kind: 'choice',
  name: '開ける',
  tags: [],
  check: {
    ability: 'body',
    target: 8,
    onSuccess: '扉が軋みながら開く',
    onFailure: '扉は動かず、手を痛める（HP-2）',
  },
};
const inspectDoor: CardDef = {
  id: 'ch-inspect',
  kind: 'choice',
  name: '調べる',
  tags: [],
  check: {
    ability: 'mind',
    target: 7,
    onSuccess: '扉の隙間に紙が挟まっていることに気づく',
    onFailure: '何も分からないまま時間が過ぎる',
  },
};
const goBack: CardDef = { id: 'ch-back', kind: 'choice', name: '戻る', tags: [] };

// ---------- 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール） ----------
// 数値は docs/plans/2026-09-23-自動戦闘エンジン.md 3-6 のシミュレーションで選んだプレイテスト前の目安。
// 素直な優先順位（斬撃のみ／渾身の一撃→斬撃）で勝率6〜7割、決着ラウンドの中央値4。

/**
 * ソロ開始時の初期装備（仮ルール）。村スタートのシナリオは村パートで得るようになったため、
 * いまはテスト専用の試験シナリオ（sc-exam-*）だけが使う
 */
const soloStarter: NonNullable<Scenario['soloStarter']> = {
  hp: 20,
  baseActionValue: 10,
  cards: [cards.slash, cards.heavyBlow, cards.firstAid],
};

/** テスト用シナリオの初期装備。自動戦闘の効果を持たないカード（短剣）も混ぜ、優先順位に入れられないことを確かめる */
const testStarter: NonNullable<Scenario['soloStarter']> = {
  ...soloStarter,
  cards: [...soloStarter.cards, cards.shortSword],
};

const enemyAttack = (
  id: string,
  name: string,
  actionCost: number,
  dice: { count: number; sides: number; bonus: number },
): CardDef => ({
  id,
  kind: 'skill',
  name,
  tags: ['戦闘スキル', '攻撃'],
  actionCost,
  combatEffect: { type: 'damage', dice },
});

const examinerCard: CardDef = {
  id: 'en-examiner',
  kind: 'enemy',
  name: '試験官',
  description: '冒険者ギルドの試験官。木剣を構えている',
  tags: [],
};

/** 敵の優先順位の行（試験官は条件を付けず、すべて「いつでも」） */
const always = (card: CardDef): PriorityEntry => ({ card, when: 'always' });

const examinerActions = [
  enemyAttack('ea-heavy', '重い打ち込み', 6, { count: 1, sides: 6, bonus: 0 }),
  enemyAttack('ea-feint', '牽制', 3, { count: 1, sides: 3, bonus: 0 }),
];

const examiner: AutoCombatEnemy = {
  card: examinerCard,
  hp: 26,
  baseActionValue: 9,
  priority: examinerActions.map(always),
};

/**
 * 導入→冒険者試験（自動戦闘）→結末 の一式を持つGMレスのソロ用シナリオを作る。
 * ノードIDは `${prefix}-intro` / `${prefix}-exam` / `${prefix}-end`。
 */
function examScenario(o: {
  id: string;
  prefix: string;
  title: string;
  summary: string;
  enemy: AutoCombatEnemy;
  maxRounds?: number;
  starter?: Scenario['soloStarter'];
  introCards?: CardDef[];
}): Scenario {
  const p = o.prefix;
  return {
    id: o.id,
    title: o.title,
    authorId: 'system',
    authorName: 'システム',
    summary: o.summary,
    referenceTags: ['HPを参照', '戦闘スキルを参照'],
    prerequisiteTags: [],
    partySize: { min: 1, max: 1 },
    // 自動戦闘は空間モデルを使わない（docs/cartagraph/scenario-flow.md）
    spaceModel: null,
    recommendedCp: 0,
    baseCp: 0,
    // GMレス・ソロプレイ用（docs/cartagraph/play-and-field.md「GMレスセッションでの提案の扱い」）
    proposalHandling: 'auto-resolve',
    soloStarter: o.starter,
    deck: [
      {
        id: `${p}-intro`,
        kind: 'intro',
        name: '村はずれ',
        cards: [
          ...(o.introCards ?? []),
          {
            id: `${p}-to-guild`,
            kind: 'choice',
            name: '街の冒険者ギルドへ向かう',
            tags: [],
            nextNodeId: `${p}-exam`,
          },
        ],
      },
      {
        id: `${p}-exam`,
        kind: 'scene',
        name: '冒険者試験',
        cards: [
          {
            id: `${p}-accept`,
            kind: 'choice',
            name: '合格の証を受け取る',
            tags: [],
            nextNodeId: `${p}-end`,
          },
        ],
        autoCombat: { enemy: o.enemy, maxRounds: o.maxRounds ?? 20 },
      },
      { id: `${p}-end`, kind: 'ending', name: '冒険者として旅立つ', cards: [] },
    ],
    endings: [],
    libraryStatus: 'draft',
    updatedAt: ago(0),
  };
}

// ---------- 村パート（docs/cartagraph/solo-village.md、GM不在のソロの仮ルール） ----------

/** 村パートで得る HP（探索者になったとき）と行動値（冒険者になったとき） */
const soloGrowth: NonNullable<Scenario['soloGrowth']> = { hp: 20, baseActionValue: 10 };

/** お店で習える戦闘スキル */
const shopSkills = [cards.slash, cards.heavyBlow, cards.quickThrust, cards.firstAid];

/** 依頼1件の定義。解決方法は体・技・心の順に [名前, 解決の描写] */
interface Quest {
  key: string;
  name: string;
  from: string;
  achievementName: string;
  solutions: [string, string][];
}

const quests: Quest[] = [
  {
    key: '猪',
    name: '畑を荒らす猪',
    from: '農家のおばさん',
    achievementName: '猪の件を片づけた',
    solutions: [
      ['柵で畑を囲む', '杭を打ち、柵で畑をぐるりと囲んだ。これで猪も入ってこられない。'],
      ['罠を仕掛ける', '獣道に括り罠を仕掛けた。翌朝、猪は罠を嫌って山へ帰っていった。'],
      [
        '山の番人に猪の通り道を聞く',
        '山の番人から猪の通り道を聞き出し、そこに鳴子を吊るした。猪は畑に近寄らなくなった。',
      ],
    ],
  },
  {
    key: '水車',
    name: '壊れた水車',
    from: '粉ひきの親方',
    achievementName: '水車の件を片づけた',
    solutions: [
      [
        '水の中で軸を押し戻す',
        '冷たい川に入り、ずれた軸を力ずくで押し戻した。水車がまた回りはじめた。',
      ],
      [
        '歯車を組み直す',
        '欠けた歯車を外し、予備の歯車に組み直した。水車は前より静かに回っている。',
      ],
      [
        '親方の昔話から直し方を思い出させる',
        '若いころの話に耳を傾けるうち、親方は昔の直し方を思い出した。二人で水車を直した。',
      ],
    ],
  },
  {
    key: '子ヤギ',
    name: '迷子の子ヤギ',
    from: '村長',
    achievementName: '子ヤギの件を片づけた',
    solutions: [
      ['崖の下まで降りて抱えて戻る', '崖の下で震えていた子ヤギを抱え、岩場をよじ登って戻った。'],
      ['足跡をたどる', 'ぬかるみに残った小さな足跡をたどり、茂みの奥で子ヤギを見つけた。'],
      [
        '泣いている孫を落ち着かせ、ヤギの好物を聞き出す',
        '村長の孫をなだめて好物を聞き出し、クローバーの束で子ヤギを呼び戻した。',
      ],
    ],
  },
];

const ABILITY_ORDER = ['body', 'skill', 'mind'] as const;

/** 依頼のノード：解決方法3枚（能力値＋1・引換カード・達成カードを得て広場へ戻る）と「広場へ戻る」 */
function questNode(p: string, q: Quest, index: number): DeckNode {
  const square = `${p}-square`;
  return {
    id: `${p}-quest-${index}`,
    kind: 'scene',
    name: `${q.name}（${q.from}の依頼）`,
    cards: [
      ...q.solutions.map(
        ([name, description], i): CardDef => ({
          id: `${p}-quest-${index}-${ABILITY_ORDER[i]}`,
          kind: 'choice',
          name,
          description,
          tags: [],
          nextNodeId: square,
          soloEffect: {
            raiseAbility: ABILITY_ORDER[i],
            // 引換カード（「〇〇からの報酬」。character-growth.md の報酬カードとは別物）
            gainCards: [
              {
                id: `c-voucher-${index}`,
                kind: 'item',
                name: `${q.from}からの報酬`,
                description: 'お店で戦闘スキル1つと交換できる',
                tags: ['引換'],
              },
            ],
            achievement: {
              id: `${p}-ach-${index}`,
              kind: 'info',
              name: q.achievementName,
              tags: ['達成', `達成:${q.key}`],
            },
          },
        }),
      ),
      {
        id: `${p}-quest-${index}-back`,
        kind: 'choice',
        name: '広場へ戻る',
        tags: [],
        nextNodeId: square,
      },
    ],
  };
}

/** お店のノード：習うカード（引換カード1枚と交換。習ったスキルは並ばない）と「お店を出る」 */
function shopNode(p: string): DeckNode {
  return {
    id: `${p}-shop`,
    kind: 'scene',
    name: '村のお店',
    cards: [
      ...shopSkills.map(
        (skill): CardDef => ({
          id: `${p}-learn-${skill.id}`,
          kind: 'choice',
          name: `${skill.name}を習う`,
          description: `店主の手ほどきで「${skill.name}」を身につけた。`,
          tags: [],
          dealWhen: { lacksCards: [skill.id] },
          playWhen: { hasTags: ['引換'] },
          soloEffect: { consumeTag: '引換', gainCards: [skill] },
        }),
      ),
      {
        id: `${p}-shop-leave`,
        kind: 'choice',
        name: 'お店を出る',
        tags: [],
        nextNodeId: `${p}-square`,
      },
    ],
  };
}

/**
 * 村パート（導入→村の広場⇄依頼3件・お店）→冒険者試験→結末 のGMレスのソロ用シナリオを作る。
 * キャラクターは旅人で始まり、依頼で能力値とHP、お店で戦闘スキルと行動値を得る。
 * 試験・結末のノードと共通の設定は examScenario() のものを使う
 */
function villageScenario(o: {
  id: string;
  prefix: string;
  title: string;
  summary: string;
  enemy: AutoCombatEnemy;
  squareCards?: CardDef[];
}): Scenario {
  const p = o.prefix;
  const square = `${p}-square`;
  const base = examScenario(o);
  const examAndEnding = base.deck.filter((n) => n.id !== `${p}-intro`);
  return {
    ...base,
    referenceTags: ['体・技・心を参照', 'HPを参照', '戦闘スキルを参照'],
    soloGrowth,
    deck: [
      {
        id: `${p}-intro`,
        kind: 'intro',
        name: '村はずれ',
        cards: [
          {
            id: `${p}-look-around`,
            kind: 'choice',
            name: '辺りを見回す',
            // GM不在のセッションでは、この説明文がそのまま描写として返る（handlers.ts の /play）
            description:
              '朝もやの向こうに、畑仕事に出る村人たちと、街へ続く一本道が見える。道の先に冒険者ギルドがあるはずだ。',
            tags: [],
          },
          {
            id: `${p}-to-square`,
            kind: 'choice',
            name: '村の広場へ向かう',
            tags: [],
            nextNodeId: square,
          },
        ],
      },
      {
        id: square,
        kind: 'scene',
        name: '村の広場',
        cards: [
          ...quests.map(
            (q, i): CardDef => ({
              id: `${p}-to-quest-${i}`,
              kind: 'choice',
              name: `依頼「${q.name}」`,
              tags: [],
              nextNodeId: `${p}-quest-${i}`,
              dealWhen: { lacksTags: [`達成:${q.key}`] },
            }),
          ),
          {
            id: `${p}-to-shop`,
            kind: 'choice',
            name: 'お店へ行く',
            tags: [],
            nextNodeId: `${p}-shop`,
          },
          {
            id: `${p}-to-guild`,
            kind: 'choice',
            name: '街の冒険者ギルドへ向かう',
            tags: [],
            nextNodeId: `${p}-exam`,
            // 攻撃の手段が無いまま試験に入ると勝てず、戻る手段も無いため（solo-village.md「配る条件・使える条件」）
            playWhen: { hasTags: ['攻撃'] },
          },
          ...(o.squareCards ?? []),
        ],
      },
      ...quests.map((q, i) => questNode(p, q, i)),
      shopNode(p),
      ...examAndEnding,
    ],
  };
}

export const scenarios: Scenario[] = [
  {
    id: 'sc-gray-mansion',
    title: '灰色館の一夜',
    authorId: 'u-kotone',
    authorName: '琴音',
    summary: '嵐の夜、灰色の館に迷い込んだ一行。地下回廊の奥の扉の向こうに、館の秘密が眠っている。',
    referenceTags: ['体・技・心を参照', 'HPを参照'],
    prerequisiteTags: [],
    partySize: { min: 2, max: 4 },
    spaceModel: null,
    recommendedCp: 3,
    baseCp: 3,
    proposalHandling: 'gm-required',
    deck: [
      {
        id: 'd-intro',
        kind: 'intro',
        name: '灰色館へ到着',
        cards: [{ id: 'loc-gate', kind: 'location', name: '館の正門', tags: [] }],
      },
      {
        id: 'd-s1',
        kind: 'scene',
        name: '3-1 地下回廊',
        cards: [{ id: 'loc-corridor', kind: 'location', name: '地下回廊', tags: [] }],
      },
      {
        id: 'd-s2',
        kind: 'scene',
        name: '3-2 奥の扉',
        cards: [
          { id: 'loc-door', kind: 'location', name: '奥の扉', tags: [] },
          openDoor,
          inspectDoor,
          goBack,
          { id: 'info-letter', kind: 'info', name: '何かが書かれた紙', tags: [], faceDown: true },
        ],
      },
      {
        id: 'd-s3',
        kind: 'scene',
        name: '3-3 隠し書庫',
        cards: [{ id: 'loc-library', kind: 'location', name: '隠し書庫', tags: [] }],
      },
      {
        id: 'd-npc',
        kind: 'npc',
        name: '館の老従者',
        cards: [
          { id: 'npc-butler', kind: 'npc', name: '館の老従者', tags: ['正体は裏'], faceDown: true },
        ],
      },
      { id: 'd-end', kind: 'ending', name: '結末', cards: [] },
    ],
    endings: [
      { id: 'e1', name: '扉を壊して真相にたどり着いた結末', grantsTag: '館の秘密を知る' },
      { id: 'e2', name: '扉を開けず引き返した結末', grantsTag: '館に未練を残す' },
      { id: 'e3', name: '老従者と和解した結末' },
    ],
    libraryStatus: 'published',
    updatedAt: ago(24 * 3),
  },
  {
    id: 'sc-galleon',
    title: '鉄鎖のガレオン船',
    authorId: 'u-me',
    authorName: 'ユウ',
    summary: '鎖で繋がれた幽霊船を舞台にした冒険者向けシナリオ。甲板での戦闘を含む。',
    referenceTags: ['体・技・心を参照', 'HPを参照', '戦闘スキルを参照'],
    prerequisiteTags: ['航海の心得', '戦闘スキル'],
    partySize: { min: 3, max: 5 },
    spaceModel: '2d',
    recommendedCp: 5,
    baseCp: 4,
    proposalHandling: 'gm-required',
    deck: [
      { id: 'g-intro', kind: 'intro', name: '港の酒場', cards: [] },
      { id: 'g-s1', kind: 'scene', name: '1 鎖の桟橋', cards: [] },
      {
        id: 'g-s2',
        kind: 'scene',
        name: '2 甲板の戦い',
        dense: true,
        cards: [{ id: 'en-ghost', kind: 'enemy', name: '鎖の亡霊', tags: ['弱点未判明'] }],
      },
      { id: 'g-s3', kind: 'scene', name: '3 船長室', cards: [] },
      { id: 'g-end', kind: 'ending', name: '結末', cards: [] },
    ],
    endings: [
      { id: 'g-e1', name: '船を解き放った結末', grantsTag: '鎖を断った者' },
      { id: 'g-e2', name: '船と共に沈んだ結末' },
    ],
    libraryStatus: 'published',
    updatedAt: ago(24 * 10),
  },
  {
    id: 'sc-corridor-after',
    title: '灯りの回廊・後日談',
    authorId: 'u-kotone',
    authorName: '琴音',
    summary: '「灯りの回廊」を経験したPCだけが辿れる短い後日談。',
    referenceTags: [],
    prerequisiteTags: ['灯りの回廊を経験'],
    partySize: { min: 1, max: 3 },
    spaceModel: null,
    recommendedCp: 2,
    baseCp: 2,
    proposalHandling: 'gm-required',
    deck: [
      { id: 'a-intro', kind: 'intro', name: '再び回廊へ', cards: [] },
      { id: 'a-end', kind: 'ending', name: '結末', cards: [] },
    ],
    endings: [{ id: 'a-e1', name: '灯りを守った結末' }],
    libraryStatus: 'published',
    updatedAt: ago(24 * 20),
  },
  {
    id: 'sc-draft-well',
    title: '涸れ井戸の底（下書き）',
    authorId: 'u-me',
    authorName: 'ユウ',
    summary: '村外れの涸れ井戸から続く横穴を探索する、書きかけの探索者向けシナリオ。',
    referenceTags: ['体・技・心を参照'],
    prerequisiteTags: [],
    partySize: { min: 2, max: 3 },
    spaceModel: null,
    recommendedCp: 3,
    baseCp: 3,
    proposalHandling: 'gm-required',
    deck: [{ id: 'w-intro', kind: 'intro', name: '井戸の縁', cards: [] }],
    endings: [],
    libraryStatus: 'draft',
    updatedAt: ago(5),
  },
  // 村スタート冒険者キャンペーンの検証用シナリオ（docs/plans/2026-09-23-村スタート冒険者キャンペーン.md）。
  // 村パート（C3）→冒険者試験（自動戦闘、C2）→結末。街道と旧チュートリアルの置き換えは C4。
  villageScenario({
    id: 'sc-village-start',
    prefix: 'vs',
    title: '（仮）村はずれの一歩',
    summary: '朝もやの中、村はずれの道が街へと続いている。',
    enemy: examiner,
  }),
  // ---- 村パートのテスト専用シナリオ。試験官は sc-exam-always-win と同じく必ず倒せる数値 ----
  villageScenario({
    id: 'sc-village-always-win',
    prefix: 'vw',
    title: '（テスト用）必ず合格する村はずれ',
    summary: 'テスト専用シナリオ。',
    enemy: { ...examiner, hp: 1 },
    // 成長の効果を持ち、シナリオに無いノードを指す選択肢（効果と遷移をまとめて失敗させる確認用）
    squareCards: [
      {
        id: 'vw-lost',
        kind: 'choice',
        name: '（テスト用）迷い道',
        tags: [],
        nextNodeId: 'vw-nowhere',
        soloEffect: { raiseAbility: 'mind' },
      },
    ],
  }),
  // ---- 自動戦闘のテスト専用シナリオ。乱数の出目によらず結果が決まる数値にしてある ----
  // 必ず勝つ：試験官の行動値9 < PLの10 なのでPLが先に動き、HP1は斬撃の最小ダメージ1で倒れる
  examScenario({
    id: 'sc-exam-always-win',
    prefix: 'aw',
    title: '（テスト用）必ず合格する試験',
    summary: 'テスト専用シナリオ。',
    enemy: { ...examiner, hp: 1 },
    starter: testStarter,
  }),
  // 必ず負ける：試験官の行動値11 > PLの10 なので試験官が先に動き、最小ダメージ20でPLのHP20が尽きる
  examScenario({
    id: 'sc-exam-always-lose',
    prefix: 'al',
    title: '（テスト用）必ず不合格になる試験',
    summary: 'テスト専用シナリオ。',
    enemy: {
      ...examiner,
      baseActionValue: 11,
      priority: [
        always(enemyAttack('ea-finisher', '本気の一撃', 11, { count: 1, sides: 1, bonus: 19 })),
      ],
    },
    starter: testStarter,
  }),
  // 必ず時間切れ：上限1ラウンドで、PLの1ラウンドの最大ダメージ12 < 試験官のHP100、試験官の攻撃は1ダメージのみ
  examScenario({
    id: 'sc-exam-always-timeout',
    prefix: 'at',
    title: '（テスト用）時間切れになる試験',
    summary: 'テスト専用シナリオ。',
    enemy: {
      ...examiner,
      hp: 100,
      priority: [always(enemyAttack('ea-poke', '小突く', 9, { count: 1, sides: 1, bonus: 0 }))],
    },
    maxRounds: 1,
    starter: testStarter,
  }),
  // 初期装備なし：HP・行動値を持たないキャラクターで自動戦闘に入った場合の確認用。
  // 導入には、シナリオに無いノードを指す選択肢カード（遷移失敗の確認用）も置く
  examScenario({
    id: 'sc-exam-no-starter',
    prefix: 'ns',
    title: '（テスト用）初期装備なしの試験',
    summary: 'テスト専用シナリオ。',
    enemy: examiner,
    introCards: [
      { id: 'ns-lost', kind: 'choice', name: '迷い道へ入る', tags: [], nextNodeId: 'ns-nowhere' },
    ],
  }),
  {
    // C1境界値テスト専用：提案不可（disabled）のGMレスシナリオ確認用
    id: 'sc-village-no-propose',
    title: '（テスト用）提案不可の村はずれ',
    authorId: 'system',
    authorName: 'システム',
    summary: 'テスト専用シナリオ。',
    referenceTags: [],
    prerequisiteTags: [],
    partySize: { min: 1, max: 1 },
    spaceModel: null,
    recommendedCp: 0,
    baseCp: 0,
    proposalHandling: 'disabled',
    deck: [
      {
        id: 'vnp-intro',
        kind: 'intro',
        name: '村はずれ（提案不可）',
        cards: [{ id: 'vnp-look-around', kind: 'choice', name: '辺りを見回す', tags: [] }],
      },
      { id: 'vnp-end', kind: 'ending', name: '結末', cards: [] },
    ],
    endings: [],
    libraryStatus: 'draft',
    updatedAt: ago(0),
  },
  {
    // C1境界値テスト専用：導入シーン（introノード）を持たないシナリオでstart-soloを呼んだ場合の確認用
    id: 'sc-no-intro',
    title: '（テスト用）導入なしシナリオ',
    authorId: 'system',
    authorName: 'システム',
    summary: 'テスト専用シナリオ。',
    referenceTags: [],
    prerequisiteTags: [],
    partySize: { min: 1, max: 1 },
    spaceModel: null,
    recommendedCp: 0,
    baseCp: 0,
    proposalHandling: 'auto-resolve',
    deck: [{ id: 'ni-scene', kind: 'scene', name: 'シーン', cards: [] }],
    endings: [],
    libraryStatus: 'draft',
    updatedAt: ago(0),
  },
];

// ---------- 募集 ----------
export const recruitments: Recruitment[] = [
  {
    id: 'rc-1',
    scenarioId: 'sc-gray-mansion',
    scenarioTitle: '灰色館の一夜',
    gmId: 'u-kirino',
    gmName: '霧乃',
    partySize: { min: 2, max: 4 },
    spaceModel: null,
    recommendedCp: 3,
    referenceTags: ['体・技・心'],
    prerequisiteTags: [],
    applicants: [{ characterId: 'pc-mio', characterName: '澪', playerName: 'カヤ' }],
    capacity: 2,
    status: 'open',
  },
  {
    id: 'rc-2',
    scenarioId: 'sc-galleon',
    scenarioTitle: '鉄鎖のガレオン船',
    gmId: 'u-hiiragi',
    gmName: '柊',
    partySize: { min: 3, max: 5 },
    spaceModel: '2d',
    recommendedCp: 5,
    referenceTags: ['戦闘スキル'],
    prerequisiteTags: ['航海の心得', '戦闘スキル'],
    applicants: [
      { characterId: 'pc-akira', characterName: '彰', playerName: '柊' },
      { characterId: 'pc-mio', characterName: '澪', playerName: 'カヤ' },
    ],
    capacity: 4,
    status: 'open',
  },
  {
    id: 'rc-3',
    scenarioId: 'sc-corridor-after',
    scenarioTitle: '灯りの回廊・後日談',
    gmId: 'u-kirino',
    gmName: '霧乃',
    partySize: { min: 1, max: 3 },
    spaceModel: null,
    recommendedCp: 2,
    referenceTags: [],
    prerequisiteTags: ['灯りの回廊を経験'],
    applicants: [],
    capacity: 3,
    status: 'open',
  },
];

// ---------- セッション ----------
export const sessions: Session[] = [
  {
    id: 'ss-mansion',
    scenarioId: 'sc-gray-mansion',
    scenarioTitle: '灰色館の一夜',
    gmId: 'u-kirino',
    gmName: '霧乃',
    partyName: '迷い星',
    status: 'playing',
    mode: 'light',
    proposalHandling: 'gm-required',
    currentScene: { index: 4, total: 7, name: '3-2 奥の扉', path: '地下回廊 › 奥の扉' },
    participants: [
      {
        userId: 'u-me',
        name: 'ユウ',
        role: 'driver',
        characterId: 'pc-jin',
        characterName: '迅',
        lastSeenAt: ago(3),
      },
      {
        userId: 'u-kaya',
        name: 'カヤ',
        role: 'navigator',
        characterId: 'pc-mio',
        characterName: '澪',
        lastSeenAt: ago(28),
      },
      { userId: 'u-ruu', name: 'ルウ', role: 'navigator', lastSeenAt: ago(24 * 3) },
      { userId: 'u-kirino', name: '霧乃', role: 'gm', lastSeenAt: ago(1) },
    ],
    field: {
      gmOnly: [
        { id: 'npc-butler', kind: 'npc', name: '館の老従者', tags: [], zone: 'gm' },
        { id: 'sc-hidden', kind: 'scene', name: '3-3 隠し書庫', tags: [], zone: 'gm' },
        { id: 'info-truth', kind: 'info', name: '館の真相', tags: [], zone: 'gm' },
      ],
      plVisible: [
        { id: 'loc-door', kind: 'location', name: '奥の扉', tags: [], zone: 'pl' },
        {
          id: 'info-letter',
          kind: 'info',
          name: '何かが書かれた紙',
          tags: [],
          zone: 'pl',
          faceDown: true,
        },
        { id: 'loc-corridor', kind: 'location', name: '地下回廊', tags: [], zone: 'pl' },
      ],
    },
    hand: [openDoor, inspectDoor, goBack, cards.lantern, cards.nightEye, cards.foresight],
    flavor: '古びた扉の向こうから、かすかな音が聞こえる。',
    proposals: [
      {
        id: 'pr-1',
        sessionId: 'ss-mansion',
        byName: '迅（ドライバー）',
        sceneName: '3-2 奥の扉',
        text: '扉を壊してみたい',
        presentedChoices: ['開ける', '調べる', '戻る'],
        status: 'pending',
        createdAt: ago(3),
      },
      {
        id: 'pr-2',
        sessionId: 'ss-mansion',
        byName: 'ルウ（ドライバー）',
        sceneName: '2-4 灯りの回廊',
        text: '灯りを消してみたい',
        presentedChoices: ['進む', '戻る'],
        status: 'approved-unused',
        resolution:
          '「灯りを消す」を生成して手札に加えたが、その前に「戻る」が選ばれたため、このシーンでは使われなかった。',
        createdAt: ago(24 * 3),
      },
      {
        id: 'pr-3',
        sessionId: 'ss-mansion',
        byName: '迅（ドライバー）',
        sceneName: '3-1 地下回廊',
        text: '壁を叩いて音を確かめたい',
        presentedChoices: ['進む', '調べる'],
        status: 'rejected',
        resolution: 'このシーンには反応する仕掛けを用意していないため。',
        createdAt: ago(24),
      },
    ],
    feed: [
      { id: 'f-1', at: ago(3), text: '迅が新たな選択肢を提案「扉を壊してみたい」' },
      { id: 'f-2', at: ago(20), text: '「奥の扉」が場に追加された', cardName: '奥の扉' },
      { id: 'f-3', at: ago(24), text: '霧乃が提案「壁を叩いて音を確かめたい」を却下' },
      { id: 'f-4', at: ago(26), text: '迅が「進む」をプレイ — 地下回廊を進んだ', cardName: '進む' },
    ],
    lastActivityAt: ago(3),
    suspendAt: later(21),
  },
  {
    id: 'ss-galleon',
    scenarioId: 'sc-galleon',
    scenarioTitle: '鉄鎖のガレオン船',
    gmId: 'u-me',
    gmName: 'ユウ',
    partyName: '潮騒',
    status: 'playing',
    mode: 'dense',
    proposalHandling: 'gm-required',
    currentScene: { index: 3, total: 5, name: '2 甲板の戦い', path: '鎖の桟橋 › 甲板' },
    participants: [
      {
        userId: 'u-hiiragi',
        name: '柊',
        role: 'driver',
        characterId: 'pc-akira',
        characterName: '彰',
        lastSeenAt: ago(6),
      },
      {
        userId: 'u-kaya',
        name: 'カヤ',
        role: 'navigator',
        characterId: 'pc-mio',
        characterName: '澪',
        lastSeenAt: ago(7),
      },
      { userId: 'u-me', name: 'ユウ', role: 'gm', lastSeenAt: ago(0.5) },
    ],
    field: {
      gmOnly: [{ id: 'info-captain', kind: 'info', name: '船長の正体', tags: [], zone: 'gm' }],
      plVisible: [
        { id: 'en-ghost', kind: 'enemy', name: '鎖の亡霊', tags: ['弱点未判明'], zone: 'pl' },
        { id: 'loc-deck', kind: 'location', name: '甲板', tags: [], zone: 'pl' },
      ],
    },
    hand: [cards.slash, cards.heavyBlow, cards.step],
    flavor: '鎖の軋む音とともに、亡霊が甲板へ這い上がってくる。カウント13、彰の手番。',
    proposals: [
      {
        id: 'pr-g1',
        sessionId: 'ss-galleon',
        byName: '彰（ドライバー）',
        sceneName: '2 甲板の戦い',
        text: '鎖を切って亡霊を海に落としたい',
        presentedChoices: ['斬撃', '渾身の一撃', '踏み込み'],
        status: 'pending',
        createdAt: ago(6),
      },
    ],
    feed: [
      { id: 'fg-1', at: ago(6), text: '彰が新たな選択肢を提案「鎖を切って亡霊を海に落としたい」' },
      { id: 'fg-2', at: ago(7), text: '戦闘イベントにより濃密モードへ切り替わった' },
    ],
    lastActivityAt: ago(0.5),
    suspendAt: later(24 * 2),
  },
  {
    id: 'ss-ended',
    scenarioId: 'sc-corridor-after',
    scenarioTitle: '灯りの回廊',
    gmId: 'u-kirino',
    gmName: '霧乃',
    partyName: '迷い星',
    status: 'ended',
    mode: 'light',
    proposalHandling: 'gm-required',
    currentScene: { index: 5, total: 5, name: '結末', path: '結末' },
    participants: [
      {
        userId: 'u-me',
        name: 'ユウ',
        role: 'driver',
        characterId: 'pc-akari',
        characterName: '灯',
        lastSeenAt: ago(24 * 12),
      },
      { userId: 'u-kirino', name: '霧乃', role: 'gm', lastSeenAt: ago(24 * 12) },
    ],
    field: { gmOnly: [], plVisible: [] },
    hand: [],
    flavor: 'セッションは終了した。結末タグ「灯りの回廊を経験」が配られた。',
    proposals: [],
    feed: [{ id: 'fe-1', at: ago(24 * 12), text: '霧乃がセッションの終了を宣言した' }],
    lastActivityAt: ago(24 * 12),
    suspendAt: ago(24 * 11),
  },
];

// ---------- 共有ライブラリ ----------
export const library: LibraryEntry[] = [
  {
    id: 'lib-1',
    kind: 'location',
    name: '灰色館',
    description: '嵐の夜にだけ扉が開く館。複数のシナリオで舞台として再利用されている。',
    tags: ['舞台', '館'],
    originScenarioTitle: '灰色館の一夜',
    promotedBy: '琴音',
    promotedAt: ago(24 * 40),
  },
  {
    id: 'lib-2',
    kind: 'npc',
    name: '館の老従者',
    description: '館に仕え続ける老人。正体は条件成立まで裏。',
    tags: ['NPC', '館'],
    originScenarioTitle: '灰色館の一夜',
    promotedBy: '琴音',
    promotedAt: ago(24 * 40),
  },
  {
    id: 'lib-3',
    kind: 'relation',
    name: '幼馴染',
    description: '物語上意味を持つ関係性カードの代表例。太いエッジとしてグラフに現れる。',
    tags: ['関係性'],
    originScenarioTitle: '灯りの回廊',
    promotedBy: 'システム製作者',
    promotedAt: ago(24 * 90),
  },
  {
    id: 'lib-4',
    kind: 'equipment',
    name: '炎の剣',
    description:
      '「鉄鎖のガレオン船」の報酬カード。共有ライブラリに格上げされ、他のシナリオでも報酬として使える。',
    tags: ['武器', '報酬'],
    originScenarioTitle: '鉄鎖のガレオン船',
    promotedBy: 'ユウ',
    promotedAt: ago(24 * 8),
  },
  {
    id: 'lib-5',
    kind: 'enemy',
    name: '鎖の亡霊',
    description: '鎖に縛られた亡霊。弱点は状態タグで表現する。',
    tags: ['海', '亡霊'],
    originScenarioTitle: '鉄鎖のガレオン船',
    promotedBy: 'ユウ',
    promotedAt: ago(24 * 8),
  },
  {
    id: 'lib-6',
    kind: 'choice',
    name: '扉を破壊する',
    description:
      'PLの提案からGMがカード化し、後に正式な選択肢として採用された例。カード→プレイ→発見→カードの循環。',
    tags: ['進化候補から採用', '選択肢'],
    originScenarioTitle: '灰色館の一夜',
    promotedBy: '琴音',
    promotedAt: ago(24 * 2),
  },
];
