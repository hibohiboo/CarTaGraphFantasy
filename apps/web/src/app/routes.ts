// ルート定義のメタデータ。ナビゲーションとサイトマップ（/admin/sitemap）の唯一の情報源。
// 実際の要素との対応は router.tsx で行う。

export type RouteGroup = 'common' | 'pl' | 'gm' | 'creator' | 'rulebook' | 'admin';

export const GROUP_LABEL: Record<RouteGroup, string> = {
  common: '共通',
  pl: 'PL',
  gm: 'GM',
  creator: 'シナリオ作成者',
  rulebook: 'ルールブック',
  admin: 'システム管理者',
};

export interface RouteMeta {
  path: string;
  title: string;
  group: RouteGroup;
  description: string;
  /** トップナビに出す */
  nav?: boolean;
  /** サイトマップから辿るための具体例（動的ルート用） */
  example?: string;
  /** 元になった試作HTML（docs/public/preview） */
  prototype?: string;
}

export const routes: RouteMeta[] = [
  {
    path: '/',
    title: '入口',
    group: 'common',
    description: '扉のカード1枚だけの最初の画面。開くとホームへ進む',
  },

  {
    path: '/home',
    title: 'ホーム',
    group: 'pl',
    description: 'ロール別の入口。自分のセッション・PCの状況をまとめて見る',
    nav: true,
  },
  {
    path: '/pl/sessions',
    title: 'セッション選択',
    group: 'pl',
    description: '募集中のシナリオを見て、自分または借りたPCで応募する',
    nav: true,
    prototype: 'session-browse.html',
  },
  {
    path: '/pl/sessions/:sessionId/play',
    title: 'プレイページ',
    group: 'pl',
    description:
      'ドライバーとして手札からカードをプレイし、セッションに干渉する。1画面完結レイアウト',
    example: '/pl/sessions/ss-mansion/play',
    prototype: 'session-play.html',
  },
  {
    path: '/pl/characters',
    title: 'キャラクター管理',
    group: 'pl',
    description: '所有PCと借りられるPCの一覧',
    nav: true,
    prototype: 'character-sheet.html',
  },
  {
    path: '/pl/characters/new',
    title: 'キャラクター作成',
    group: 'pl',
    description: 'CP予算（ハード制約）の中でカードプールから選んでPCを作る',
    prototype: 'character-create.html',
  },
  {
    path: '/pl/tutorial',
    title: '旅立ちの酒場',
    group: 'pl',
    description: '初めてのプレイヤー向け。酒場のNPCとの短い問答を経て、最初のキャラクターができる',
  },
  {
    path: '/pl/characters/:characterId',
    title: 'キャラクターシート',
    group: 'pl',
    description: '能力値・HP・所持デッキ・称号タグ・結末タグの参照ビュー',
    example: '/pl/characters/pc-jin',
    prototype: 'character-sheet.html',
  },

  {
    path: '/gm/scenarios',
    title: 'シナリオ管理（GM）',
    group: 'gm',
    description: '共有ライブラリからシナリオを選ぶ',
    nav: true,
    prototype: 'scenario-manage.html',
  },
  {
    path: '/gm/scenarios/:scenarioId',
    title: 'シナリオのカスタマイズと募集',
    group: 'gm',
    description: '使うシーン・カードを取捨選択し、募集を出す',
    example: '/gm/scenarios/sc-gray-mansion',
  },
  {
    path: '/gm/sessions',
    title: 'セッション管理（GM）',
    group: 'gm',
    description: '自分がGMを務めるセッションの一覧',
    nav: true,
    prototype: 'session-gm-manage.html',
  },
  {
    path: '/gm/sessions/:sessionId',
    title: 'セッションの進行管理',
    group: 'gm',
    description: '参加者・場のゾーン・進行フィード・提案の裁定・モード切り替え・終了',
    example: '/gm/sessions/ss-galleon',
    prototype: 'session-gm-review.html',
  },

  {
    path: '/creator/scenarios',
    title: 'シナリオ管理（作成者）',
    group: 'creator',
    description: '自分が作ったシナリオの一覧と新規作成',
    nav: true,
    prototype: 'scenario-manage.html',
  },
  {
    path: '/creator/scenarios/:scenarioId',
    title: 'シナリオ編集',
    group: 'creator',
    description: 'メタデータ・シナリオデッキの構造・結末タグを編集し、共有ライブラリへ公開する',
    example: '/creator/scenarios/sc-galleon',
    prototype: 'scenario-manage.html',
  },
  {
    path: '/creator/scenarios/:scenarioId/scenes/:sceneId',
    title: 'シーン編集',
    group: 'creator',
    description: 'ロケーション・NPC・情報・イベントカードの配置、目的・終了条件（仮）の編集',
    example: '/creator/scenarios/sc-gray-mansion/scenes/d-s2',
    prototype: 'scene-builder.html',
  },

  {
    path: '/rulebook',
    title: 'ルールブック',
    group: 'rulebook',
    description: '遊び方・判定ルール・共有設定の目次',
    nav: true,
  },
  {
    path: '/rulebook/how-to-play',
    title: '遊び方',
    group: 'rulebook',
    description: 'カード・デッキ・場・手札の考え方と、セッションの進み方',
  },
  {
    path: '/rulebook/checks',
    title: '判定ルール',
    group: 'rulebook',
    description: '探索判定（体・技・心＋2d6）と戦闘（カウント制・射程）',
  },
  {
    path: '/rulebook/library',
    title: '共有設定',
    group: 'rulebook',
    description:
      'セッションから積みあがった共有ライブラリ（正史グラフから格上げされた設定・カード）',
    prototype: 'cartagraph-zukan.html',
  },

  {
    path: '/admin/sitemap',
    title: 'サイトマップ',
    group: 'admin',
    description: '全ページの一覧と役割',
    nav: true,
  },
  {
    path: '/admin/components',
    title: 'コンポーネントカタログ',
    group: 'admin',
    description: '共通UI部品の一覧とバリエーション',
  },
];

export const navRoutes = routes.filter((r) => r.nav);
export const findRoute = (path: string) => routes.find((r) => r.path === path);
