import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/CarTaGraphFantasy/',
  title: 'カルタグラフTRPG',
  description: '進化型カードTRPG「カルタグラフ」の設計ドキュメント',
  lang: 'ja-JP',

  themeConfig: {
    nav: [
      { text: 'ホーム', link: '/' },
      { text: 'コンセプト', link: '/concept/' },
      { text: 'カルタグラフ', link: '/cartagraph/' },
      { text: '用語集', link: '/glossary' },
      { text: '未解決論点', link: '/open-questions' }
    ],

    sidebar: [
      {
        text: 'コンセプト',
        items: [
          { text: '進化するTRPGとは', link: '/concept/' }
        ]
      },
      {
        text: 'カルタグラフ構想',
        items: [
          { text: '全体像', link: '/cartagraph/' },
          { text: 'カード・デッキの考え方', link: '/cartagraph/card-and-deck' },
          { text: '場・手札・プレイ', link: '/cartagraph/play-and-field' },
          { text: 'カードの裏表', link: '/cartagraph/card-face-back' }
        ]
      },
      {
        text: 'リファレンス',
        items: [
          { text: '用語集', link: '/glossary' },
          { text: '未解決論点トラッカー', link: '/open-questions' }
        ]
      },
      {
        text: '議論ログ（アーカイブ）',
        items: [
          { text: '追加インタビュー (2025-09)', link: '/interviews/2025-09-追加インタビュー' }
        ]
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
          { text: 'カルタグラフ図鑑（閲覧サイト試作）', link: '/preview/cartagraph-zukan.html', target: '_self' },
          { text: 'プレイ画面（ドライバー視点）', link: '/preview/session-play.html', target: '_self' },
          { text: 'GM承認画面', link: '/preview/session-gm-review.html', target: '_self' },
          { text: 'チャット（ドライバー/ナビゲーター/GM）', link: '/preview/session-chat.html', target: '_self' },
          { text: 'GMのセッション管理', link: '/preview/session-gm-manage.html', target: '_self' },
          { text: 'シナリオ製作者のシナリオ管理', link: '/preview/scenario-manage.html', target: '_self' },
          { text: 'プレイヤーのセッション選択', link: '/preview/session-browse.html', target: '_self' },
          { text: 'キャラクター作成', link: '/preview/character-create.html', target: '_self' },
          { text: 'シーン構築', link: '/preview/scene-builder.html', target: '_self' },
          { text: 'シーン進行（GM視点）', link: '/preview/scene-play.html', target: '_self' }
        ]
      }
    ],

    outline: {
      level: [2, 3]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/hibohiboo/CarTaGraphFantasy' }
    ]
  }
})
