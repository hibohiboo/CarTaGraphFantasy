// check-screens.mjs の、画面一覧・導線図とルート定義の突き合わせ（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findScreenMismatches,
  parseDiagramPaths,
  parseIssuePaths,
  parseMissingScreens,
  parseRoutes,
  parseTablePaths,
} from './check-screens.mjs';

const routesSource = `
export const routes: RouteMeta[] = [
  {
    path: '/home',
    title: 'ホーム',
    group: 'pl',
    description: 'ロール別の入口',
    nav: true,
  },
  {
    path: '/pl/sessions/:sessionId/play',
    title: 'プレイページ',
    group: 'pl',
    description:
      '手札からプレイ',
  },
  {
    path: '/admin/sitemap',
    title: 'サイトマップ',
    group: 'admin',
    description: '全ページ',
  },
];
`;

const screensMd = [
  '```mermaid',
  'flowchart TB',
  '  home["ホーム /home"]',
  '  play["プレイページ<br/>/pl/sessions/:sessionId/play"]',
  '  gmHome["GM のホーム（未実装）"]:::missing',
  '  home -->|参加中| play',
  '```',
  '',
  '| ロール | 画面 | パス | できること |',
  '|---|---|---|---|',
  '| PL | ホーム | `/home` | 入口 |',
  '| PL | プレイページ | `/pl/sessions/:sessionId/play` | 手札のプレイ。`/x` も書ける |',
  '| GM | GM のホーム | （未実装） | まだ無い |',
  '| システム管理者 | サイトマップ | `/admin/sitemap` | 全ページ |',
].join('\n');

const issuesMd = ['## ホーム', '', '`/home`', '', '本文の `/nowhere` は見ない'].join('\n');

describe('読み取り', () => {
  it('routes.ts から、パス・題・グループを読む（description が複数行でも）', () => {
    assert.deepEqual(parseRoutes(routesSource), [
      { path: '/home', title: 'ホーム', group: 'pl' },
      { path: '/pl/sessions/:sessionId/play', title: 'プレイページ', group: 'pl' },
      { path: '/admin/sitemap', title: 'サイトマップ', group: 'admin' },
    ]);
  });

  it('example があるルートは example も読み、無いルートは読めても example を持たない', () => {
    const source = `
  {
    path: '/a/:id',
    title: 'あ',
    group: 'pl',
    description: 'x',
    example: '/a/one',
  },
  {
    path: '/b',
    title: 'い',
    group: 'gm',
    description: 'y',
  },
`;
    assert.deepEqual(parseRoutes(source), [
      { path: '/a/:id', title: 'あ', group: 'pl', example: '/a/one' },
      { path: '/b', title: 'い', group: 'gm' },
    ]);
  });

  it('description の文章やコメントの中の title:・path: を拾わず、配列の後ろのコードも読まない', () => {
    const source = `
export const routes = [
  {
    path: '/a',
    title: 'It\\'s',
    group: 'pl',
    description: 'メモ title: 'x' 風 group: 'gm'',
  },
  // path: '/commented'
];
const other = { path: '/c', group: 'zzz' };
`;
    assert.deepEqual(parseRoutes(source), [{ path: '/a', title: "It\\'s", group: 'pl' }]);
  });

  it('導線図の、まだ無い画面のラベルを読む（実在する画面のノードは読まない）', () => {
    assert.deepEqual(parseMissingScreens(screensMd), ['GM のホーム（未実装）']);
    assert.deepEqual(
      parseMissingScreens('```mermaid\n  g["GM のホーム"]:::missing\n  h["ホーム /home"]\n```\n'),
      ['GM のホーム'],
    );
  });

  it('表は3列目のパスだけを読み、（未実装）の行と他の列のパスは読まない', () => {
    assert.deepEqual(parseTablePaths(screensMd), [
      '/home',
      '/pl/sessions/:sessionId/play',
      '/admin/sitemap',
    ]);
  });

  it('図はノードのラベルのパスを読み、<br/> で改行していても読める。矢印のラベルは読まない', () => {
    assert.deepEqual(parseDiagramPaths(screensMd), ['/home', '/pl/sessions/:sessionId/play']);
  });

  it('入口のパス / も読める', () => {
    assert.deepEqual(parseDiagramPaths('```mermaid\n  e["入口 /"] --> h\n```\n'), ['/']);
  });

  it('課題のページは、1行だけのパスを読み、本文中のパスは読まない', () => {
    assert.deepEqual(parseIssuePaths(issuesMd), ['/home']);
  });
});

describe('findScreenMismatches', () => {
  it('一致していれば空', () => {
    assert.deepEqual(findScreenMismatches({ routesSource, screensMd, issuesMd }), []);
  });

  it('ルートを足したのに表・図に無ければ、両方を知らせる', () => {
    const added = routesSource.replace(
      '];',
      "  {\n    path: '/gm',\n    title: 'GM のホーム',\n    group: 'gm',\n    description: 'x',\n  },\n];",
    );
    assert.deepEqual(findScreenMismatches({ routesSource: added, screensMd, issuesMd }), [
      'docs/screens/index.md の画面の一覧に、ルート /gm の行が無い',
      'docs/screens/index.md の導線図に、ルート /gm のノードが無い',
    ]);
  });

  it('ルートを消したのに表・図・課題に残っていれば、それぞれ知らせる', () => {
    const removed = routesSource.replace(/ {2}\{\n {4}path: '\/home'[\s\S]*?\n {2}\},\n/, '');
    const found = findScreenMismatches({ routesSource: removed, screensMd, issuesMd });
    assert.equal(found.length, 3);
    assert.match(found[0], /画面の一覧の \/home は/);
    assert.match(found[1], /導線図の \/home は、.*に無い/);
    assert.match(found[2], /issues\.md の \/home は/);
  });

  it('図に描かないグループのルートを図に書いたら知らせる', () => {
    const withAdmin = screensMd.replace('```\n\n', '  s["サイトマップ /admin/sitemap"]\n```\n\n');
    assert.deepEqual(findScreenMismatches({ routesSource, screensMd: withAdmin, issuesMd }), [
      'docs/screens/index.md の導線図の /admin/sitemap は、図に描かないグループ（admin）のルート',
    ]);
  });

  it('図のパスの書き方がルートと違えば（:id と :sessionId）知らせる', () => {
    const typo = screensMd.replace('/pl/sessions/:sessionId/play"]', '/pl/sessions/:id/play"]');
    const found = findScreenMismatches({ routesSource, screensMd: typo, issuesMd });
    assert.deepEqual(found, [
      'docs/screens/index.md の導線図に、ルート /pl/sessions/:sessionId/play のノードが無い',
      'docs/screens/index.md の導線図の /pl/sessions/:id/play は、apps/web/src/shared/routes/routes.ts に無い（まだ無い画面はパスを書かない）',
    ]);
  });
});
