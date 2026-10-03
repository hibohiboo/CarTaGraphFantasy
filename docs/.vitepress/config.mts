import { defineConfig } from 'vitepress';
import { githubSlug } from './slug';

export default defineConfig({
  base: '/CarTaGraphFantasy/',
  title: 'カルタグラフTRPG',
  description: '進化型カードTRPG「カルタグラフ」の設計ドキュメント',
  lang: 'ja-JP',
  // docs/plans/ は作業単位のプランドキュメント（コードのパス等を多く含む）で、公開サイトには載せない
  srcExclude: ['plans/**'],
  markdown: { anchor: { slugify: githubSlug } },

  themeConfig: {
    nav: [
      { text: 'ホーム', link: '/' },
      { text: 'コンセプト', link: '/concept/' },
      { text: 'カルタグラフ', link: '/cartagraph/' },
      { text: '用語集', link: '/glossary' },
      { text: '未解決論点', link: '/open-questions' },
      { text: 'アプリ', link: '/app/', target: '_self' },
    ],

    // 左メニューは読み手ごとに4つに分ける（2026-10-03）。まず実現したいこと（ゲームの仕様）、
    // その進み具合、作り方（開発）、資料の順。
    // ページを足したら、ここにも足す（仕様のページがメニューから辿れなくならないように）
    sidebar: [
      {
        text: 'ゲームの仕様（カルタグラフ）',
        items: [
          { text: 'コンセプト（進化するTRPG）', link: '/concept/' },
          { text: '全体像', link: '/cartagraph/' },
          {
            text: 'カードと場',
            collapsed: false,
            items: [
              { text: 'カード・デッキの考え方', link: '/cartagraph/card-and-deck' },
              { text: 'カードの裏表', link: '/cartagraph/card-face-back' },
              { text: '場・手札・プレイ', link: '/cartagraph/play-and-field' },
              { text: 'グラフの役割', link: '/cartagraph/graph' },
            ],
          },
          {
            text: 'キャラクター',
            collapsed: false,
            items: [
              { text: 'PCのロールとシナリオタイプ', link: '/cartagraph/role-and-scenario' },
              { text: '成長とキャラメイク（CP制）', link: '/cartagraph/character-growth' },
              { text: 'PC間の比較体験と称号タグ', link: '/cartagraph/comparison-and-titles' },
              { text: '段階的な開示とアンロック', link: '/cartagraph/unlock' },
            ],
          },
          {
            text: '判定と戦闘',
            collapsed: false,
            items: [
              { text: '探索者向けの判定ルール', link: '/cartagraph/exploration-check' },
              { text: '戦闘ルール', link: '/cartagraph/combat' },
              { text: '数値バランスの相場観', link: '/cartagraph/balance' },
            ],
          },
          {
            text: 'シナリオとセッション',
            collapsed: false,
            items: [
              { text: 'シナリオの構造と開始までの流れ', link: '/cartagraph/scenario-flow' },
              { text: 'パーティー編成と非同期セッション', link: '/cartagraph/party-and-session' },
              { text: 'GM不在のソロの進行（仮）', link: '/cartagraph/solo-village' },
              { text: '自動戦闘（仮）', link: '/cartagraph/auto-combat' },
              {
                text: '自動戦闘のシミュレーション結果',
                link: '/cartagraph/auto-combat-simulation',
              },
            ],
          },
          { text: '用語集', link: '/glossary' },
          { text: '未解決論点トラッカー', link: '/open-questions' },
        ],
      },
      {
        text: '進み具合',
        items: [
          { text: 'ダッシュボード', link: '/' },
          { text: 'ロードマップ', link: '/roadmap' },
          { text: '要望（バックログ）', link: '/backlog/' },
        ],
      },
      {
        text: '開発',
        items: [
          { text: '開発サイクルと体制の進化', link: '/process/' },
          {
            text: 'ルール',
            collapsed: false,
            items: [
              { text: 'アーキテクチャ（構成と依存の向き）', link: '/process/rules/architecture' },
              { text: 'テスト', link: '/process/rules/testing' },
              { text: 'レビュー', link: '/process/rules/review' },
            ],
          },
          {
            text: '技術とアプリの仕組み',
            collapsed: false,
            items: [
              { text: '技術スタック', link: '/architecture/' },
              { text: 'Webアプリの仕組み', link: '/architecture/web-app' },
              { text: '試作の引き継ぎまとめ', link: '/architecture/prototype-handover' },
            ],
          },
          { text: '既知の問題', link: '/architecture/known-issues' },
          { text: '依頼文サンプル', link: '/process/prompt-sample' },
          { text: '体制の進化ログ', link: '/process/evolution' },
        ],
      },
      {
        text: '資料',
        items: [
          // アプリは VitePress 管理外の静的ファイルなので SPA 遷移を避ける
          { text: 'アプリを開く（モックAPI）', link: '/app/', target: '_self' },
          {
            // ゲームの仕様の各ページに1対1で対応する。決めた理由・経緯・将来の拡張候補を置く
            text: 'デザイナーノート',
            link: '/notes/',
            collapsed: true,
            items: [
              { text: 'カード・デッキの考え方', link: '/notes/card-and-deck' },
              { text: 'カードの裏表', link: '/notes/card-face-back' },
              { text: '場・手札・プレイ', link: '/notes/play-and-field' },
              { text: 'グラフの役割', link: '/notes/graph' },
              { text: 'PCのロールとシナリオタイプ', link: '/notes/role-and-scenario' },
              { text: '成長とキャラメイク（CP制）', link: '/notes/character-growth' },
              { text: 'PC間の比較体験と称号タグ', link: '/notes/comparison-and-titles' },
              { text: '段階的な開示とアンロック', link: '/notes/unlock' },
              { text: '探索者向けの判定ルール', link: '/notes/exploration-check' },
              { text: '戦闘ルール', link: '/notes/combat' },
              { text: '数値バランスの相場観', link: '/notes/balance' },
            ],
          },
          {
            text: '議論ログ（アーカイブ）',
            collapsed: true,
            items: [
              {
                text: '追加インタビュー (2025-09)',
                link: '/interviews/2025-09-追加インタビュー',
              },
            ],
          },
          {
            // 試作ページはVitePressのpublicディレクトリに置いた生のHTMLで、
            // VitePress管理下のページではないため、target指定なしだと
            // VitePressのSPAルーターが横取りして404表示になる
            // （F5で直接読み込むと正しく表示されるのはそのため）。
            // target: '_self' を付けることでSPA遷移を回避し、通常の
            // ページ遷移としてブラウザに読み込ませる。
            text: '試作（未React化の画面）',
            collapsed: true,
            items: [
              // React化済みの試作は削除した（docs/plans/2026-09-27-試作HTMLの整理.md）。ここに残るのは未React化の画面だけ
              {
                text: 'チャット（ドライバー/ナビゲーター/GM）',
                link: '/preview/session-chat.html',
                target: '_self',
              },
              {
                text: 'シーン進行（GM視点）',
                link: '/preview/scene-play.html',
                target: '_self',
              },
              {
                text: '戦闘画面（2次元）',
                link: '/preview/combat-play.html',
                target: '_self',
              },
              {
                text: '戦闘画面（1次元）',
                link: '/preview/combat-play-1d.html',
                target: '_self',
              },
              {
                text: '場の状況',
                link: '/preview/session-field.html',
                target: '_self',
              },
            ],
          },
        ],
      },
    ],

    outline: {
      level: [2, 3],
    },

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/hibohiboo/CarTaGraphFantasy',
      },
    ],
  },
});
