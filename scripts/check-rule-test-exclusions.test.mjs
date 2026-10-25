import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findExclusionProblems } from './check-rule-test-exclusions.mjs';

const pages = [
  { page: 'check', sections: [{ heading: '基本' }, { heading: 'この章の設計原則' }] },
  { page: 'index', sections: [{ heading: '概要' }] },
];

describe('findExclusionProblems', () => {
  it('問題が無ければ空', () => {
    assert.deepEqual(
      findExclusionProblems({
        pages,
        exclusions: [
          { page: 'index', heading: null, reason: 'a' },
          { page: 'check', heading: 'この章の設計原則', reason: 'b' },
        ],
      }),
      [],
    );
  });

  it('T9: 表の節が実在しないと止める', () => {
    const problems = findExclusionProblems({
      pages,
      exclusions: [{ page: 'check', heading: '消えた節', reason: 'x' }],
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /check.*消えた節.*見出しが無い/);
  });

  it('T9: ページが実在しないと止める', () => {
    const problems = findExclusionProblems({
      pages,
      exclusions: [{ page: 'nothing', heading: null, reason: 'x' }],
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /nothing.*ページが無い/);
  });

  it('T9: 理由が空だと止める', () => {
    const problems = findExclusionProblems({
      pages,
      exclusions: [{ page: 'index', heading: null, reason: '' }],
    });
    assert.match(problems[0], /index.*理由/);
  });

  it('T10: 同じ節が2回出ると止める', () => {
    const problems = findExclusionProblems({
      pages,
      exclusions: [
        { page: 'check', heading: '基本', reason: 'a' },
        { page: 'check', heading: '基本', reason: 'b' },
      ],
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /check.*基本.*2回/);
  });

  it('T10: ページ全体の行と、そのページの節の行が並ぶと止める', () => {
    const problems = findExclusionProblems({
      pages,
      exclusions: [
        { page: 'check', heading: null, reason: 'a' },
        { page: 'check', heading: '基本', reason: 'b' },
      ],
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /check.*ページ全体.*節/);
  });
});
