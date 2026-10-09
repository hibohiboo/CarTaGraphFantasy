// check-provisional.mjs の、仮ルールの一覧と仕様ページの「仮」の印の突き合わせ（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findProvisionalMismatches,
  hasProvisionalMark,
  parseFrontmatter,
} from './check-provisional.mjs';

const fm = (o) =>
  [
    '---',
    ...(o.title ? [`title: ${o.title}`] : []),
    ...(o.spec ? ['spec:', ...o.spec.map((s) => `  - ${s}`)] : []),
    ...(o.decide ? [`decide: ${o.decide}`] : []),
    'updated: 2026-10-10',
    '---',
    '',
    '# 本文',
  ].join('\n');

const provisionalPage = '# 自動戦闘（仮ルール）\n\n本文';
const decidedPage = '# 自動戦闘\n\n本文に（仮ルール）と書いても見出しでなければ数えない';
const exists = (paths) => (p) => paths.includes(p);

describe('hasProvisionalMark', () => {
  it('題名・見出しの「（仮ルール）」「（仮マッピング）」「（仮）」を見つける', () => {
    assert.equal(hasProvisionalMark('# 自動戦闘（仮ルール）'), true);
    assert.equal(hasProvisionalMark('x\n## ロールごとのデッキ構成（仮マッピング）'), true);
    assert.equal(hasProvisionalMark('### 初期装備（仮）'), true);
  });
  it('本文の中の「仮」・括弧の無い「仮」は数えない', () => {
    assert.equal(hasProvisionalMark(decidedPage), false);
    assert.equal(hasProvisionalMark('# 仮置きの話'), false);
  });
});

describe('parseFrontmatter', () => {
  it('title・decide・spec の列を読む', () => {
    assert.deepEqual(
      parseFrontmatter(
        fm({ title: 'A', decide: '決める', spec: ['cartagraph/a.md', 'cartagraph/b.md'] }),
      ),
      {
        title: 'A',
        decide: '決める',
        spec: ['cartagraph/a.md', 'cartagraph/b.md'],
      },
    );
  });
  it('spec が無ければ空の列。frontmatter が無ければ null', () => {
    assert.deepEqual(parseFrontmatter(fm({ title: 'A', decide: 'd' })).spec, []);
    assert.equal(parseFrontmatter('# 本文だけ'), null);
  });
});

describe('findProvisionalMismatches', () => {
  const specPages = [
    { path: 'cartagraph/auto-combat.md', text: provisionalPage },
    { path: 'cartagraph/combat.md', text: '# 戦闘ルール' },
  ];
  const ok = {
    path: 'docs/provisional/auto-combat.md',
    text: fm({ title: '自動戦闘', decide: 'd', spec: ['cartagraph/auto-combat.md'] }),
  };
  const all = exists(['cartagraph/auto-combat.md', 'cartagraph/combat.md']);

  it('一致していれば空。spec を持たない（アプリだけの）仮ルールも置ける', () => {
    const appOnly = { path: 'docs/provisional/x.md', text: fm({ title: 'X', decide: 'd' }) };
    assert.deepEqual(
      findProvisionalMismatches({ specPages, provisional: [ok, appOnly], exists: all }),
      [],
    );
  });

  it('「仮」の印があるのに一覧に無ければ知らせる', () => {
    const errors = findProvisionalMismatches({ specPages, provisional: [], exists: all });
    assert.deepEqual(errors, [
      'docs/cartagraph/auto-combat.md に「仮」の印があるが、仮ルールの一覧（docs/provisional/）のどの spec にも無い',
    ]);
  });

  it('spec のページから「仮」の印が消えていたら、消し忘れとして知らせる', () => {
    const decided = [{ path: 'cartagraph/auto-combat.md', text: decidedPage }];
    const errors = findProvisionalMismatches({
      specPages: decided,
      provisional: [ok],
      exists: all,
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /もう「仮」の印が無い/);
  });

  it('spec のページが無ければ知らせる', () => {
    const errors = findProvisionalMismatches({
      specPages,
      provisional: [ok],
      exists: exists(['cartagraph/combat.md']),
    });
    assert.deepEqual(errors, [
      'docs/provisional/auto-combat.md の spec「cartagraph/auto-combat.md」のページが無い',
    ]);
  });

  it('title・decide が無い、frontmatter が無いファイルを知らせる', () => {
    const bad = [
      { path: 'docs/provisional/a.md', text: fm({ spec: ['cartagraph/auto-combat.md'] }) },
      { path: 'docs/provisional/b.md', text: '# 本文だけ' },
    ];
    const errors = findProvisionalMismatches({ specPages, provisional: bad, exists: all });
    assert.deepEqual(errors, [
      'docs/provisional/a.md に title が無い',
      'docs/provisional/a.md に decide（何を決めれば消せるか）が無い',
      'docs/provisional/b.md に frontmatter が無い',
    ]);
  });
});
