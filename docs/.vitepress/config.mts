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
        text: '試作',
        items: [
          { text: 'カルタグラフ図鑑（閲覧サイト試作）', link: '/preview/cartagraph-zukan.html' }
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
