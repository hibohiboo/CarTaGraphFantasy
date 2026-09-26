import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/CarTaGraphFantasy/',
  title: 'カルタグラフTRPG',
  description: '進化型カードTRPG「カルタグラフ」の設計ドキュメント',
  lang: 'ja-JP',
  // docs/plans/ は作業単位のプランドキュメント（コードのパス等を多く含む）で、公開サイトには載せない
  srcExclude: ['plans/**'],

  themeConfig: {
    nav: [
      { text: 'ホーム', link: '/' },
      { text: 'コンセプト', link: '/concept/' },
      { text: 'カルタグラフ', link: '/cartagraph/' },
      { text: '用語集', link: '/glossary' },
      { text: '未解決論点', link: '/open-questions' },
      { text: 'アプリ', link: '/app/', target: '_self' },
    ],

    sidebar: [
      {
        text: 'コンセプト',
        items: [{ text: '進化するTRPGとは', link: '/concept/' }],
      },
      {
        text: 'カルタグラフ構想',
        items: [
          { text: '全体像', link: '/cartagraph/' },
          { text: 'カード・デッキの考え方', link: '/cartagraph/card-and-deck' },
          { text: '場・手札・プレイ', link: '/cartagraph/play-and-field' },
          { text: 'カードの裏表', link: '/cartagraph/card-face-back' },
        ],
      },
      {
        text: 'アーキテクチャ',
        items: [
          { text: '技術スタック', link: '/architecture/' },
          { text: 'Webアプリ（apps/web）の構成', link: '/architecture/web-app' },
          { text: '試作の引き継ぎまとめ', link: '/architecture/prototype-handover' },
          // アプリは VitePress 管理外の静的ファイルなので SPA 遷移を避ける
          { text: 'アプリを開く（モックAPI）', link: '/app/', target: '_self' },
        ],
      },
      {
        text: 'リファレンス',
        items: [
          { text: '用語集', link: '/glossary' },
          { text: '未解決論点トラッカー', link: '/open-questions' },
        ],
      },
      {
        text: '開発プロセス',
        items: [
          { text: '開発サイクルと体制の進化', link: '/process/' },
          { text: 'アーキテクチャルール', link: '/process/rules/architecture' },
          { text: 'テストルール', link: '/process/rules/testing' },
          { text: 'レビュールール', link: '/process/rules/review' },
          { text: '依頼文サンプル', link: '/process/prompt-sample' },
          { text: '体制の進化ログ', link: '/process/evolution' },
        ],
      },
      {
        text: '議論ログ（アーカイブ）',
        items: [
          { text: '追加インタビュー (2025-09)', link: '/interviews/2025-09-追加インタビュー' },
        ],
      },
      {
        // 試作ページはVitePressのpublicディレクトリに置いた生のHTMLで、
        // VitePress管理下のページではないため、target指定なしだと
        // VitePressのSPAルーターが横取りして404表示になる
        // （F5で直接読み込むと正しく表示されるのはそのため）。
        // target: '_self' を付けることでSPA遷移を回避し、通常の
        // ページ遷移としてブラウザに読み込ませる。
        text: '試作',
        items: [
          // React化済みの試作は削除した（docs/plans/2026-09-27-試作HTMLの整理.md）。ここに残るのは未React化の画面だけ
          {
            text: 'チャット（ドライバー/ナビゲーター/GM）',
            link: '/preview/session-chat.html',
            target: '_self',
          },
          { text: 'シーン進行（GM視点）', link: '/preview/scene-play.html', target: '_self' },
          { text: '戦闘画面（2次元）', link: '/preview/combat-play.html', target: '_self' },
          { text: '戦闘画面（1次元）', link: '/preview/combat-play-1d.html', target: '_self' },
          { text: '場の状況', link: '/preview/session-field.html', target: '_self' },
        ],
      },
    ],

    outline: {
      level: [2, 3],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/hibohiboo/CarTaGraphFantasy' }],
  },
});
