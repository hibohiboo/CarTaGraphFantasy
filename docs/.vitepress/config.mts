import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/CarTaGraphFantasy/',
  title: 'カルタグラフTRPG',
  description: '進化型カードTRPG「カルタグラフ」の設計ドキュメント',
  lang: 'ja-JP',

  themeConfig: {
    nav: [
      { text: 'ホーム', link: '/' },
      { text: '設計ドキュメント', link: '/未整理/カルタグラフTRPG_設計まとめ_v0.1' }
    ],

    sidebar: [
      {
        text: '未整理ドキュメント',
        items: [
          { text: '設計まとめ v0.1', link: '/未整理/カルタグラフTRPG_設計まとめ_v0.1' },
          { text: '追加インタビュー', link: '/未整理/追加インタビュー' }
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
