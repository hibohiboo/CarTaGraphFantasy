// check-evolution-log.mjs の、進化ログの書き漏らしの判定（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkEvolutionLog,
  EVOLUTION_LOG,
  isProcessFile,
  skipReason,
} from './check-evolution-log.mjs';

describe('isProcessFile', () => {
  it('ルール・入口・.claude・git フック・CI・検査のスクリプトは、進め方に関わる', () => {
    for (const p of [
      'AGENTS.md',
      'CLAUDE.md',
      'biome.json',
      'docs/process/rules/testing.md',
      'docs/process/index.md',
      '.claude/skills/tdd/SKILL.md',
      '.claude/rules/process/rules/testing.md',
      '.claude/settings.json',
      '.githooks/pre-push',
      '.github/workflows/ci.yml',
      'scripts/check-terms.mjs',
      'scripts/check-terms.test.mjs',
    ])
      assert.equal(isProcessFile(p), true, p);
  });

  it('進化ログそのもの・自動メモリ・ゲームのシミュレーション・ビルドの出力のコピー・アプリと仕様は除く', () => {
    for (const p of [
      EVOLUTION_LOG,
      '.claude/memory/MEMORY.md',
      'scripts/simulate-auto-combat.ts',
      'scripts/copy-web-to-pages.mjs',
      'apps/web/src/main.tsx',
      'docs/cartagraph/combat.md',
      'docs/processing.md',
      'package.json',
    ])
      assert.equal(isProcessFile(p), false, p);
  });
});

describe('skipReason', () => {
  it('「進化ログ不要: <理由>」の理由を読む（全角のコロンも）', () => {
    assert.equal(skipReason('docs: 誤字\n\n進化ログ不要: 誤字の修正だけ\n'), '誤字の修正だけ');
    assert.equal(skipReason('x\n進化ログ不要：表記の統一'), '表記の統一');
  });

  it('理由が空・行の途中・# のコメント行は数えない', () => {
    assert.equal(skipReason('x\n進化ログ不要:\n'), null);
    assert.equal(skipReason('x 進化ログ不要: 途中'), null);
    assert.equal(skipReason('x\n# 進化ログ不要: コメント'), null);
  });
});

describe('checkEvolutionLog', () => {
  it('進め方に関わるファイルだけを変えて、ログが無ければ止め、そのファイルを挙げる', () => {
    const error = checkEvolutionLog({
      staged: ['AGENTS.md', 'apps/web/x.ts', 'CLAUDE.md'],
      message: 'docs: x',
    });
    assert.match(error, /AGENTS\.md/);
    assert.match(error, /CLAUDE\.md/);
    assert.doesNotMatch(error, /apps\/web/);
    assert.match(error, /進化ログ不要: <理由>/);
  });

  it('ログも一緒に変えていれば通す', () => {
    assert.equal(checkEvolutionLog({ staged: ['AGENTS.md', EVOLUTION_LOG], message: 'x' }), null);
  });

  it('理由つきで「進化ログ不要」と書けば通す', () => {
    assert.equal(
      checkEvolutionLog({ staged: ['AGENTS.md'], message: 'x\n\n進化ログ不要: 誤字' }),
      null,
    );
  });

  it('進め方に関わらないファイルだけなら通す', () => {
    assert.equal(
      checkEvolutionLog({
        staged: ['apps/web/x.ts', '.claude/memory/a.md', 'docs/cartagraph/a.md'],
        message: 'x',
      }),
      null,
    );
  });
});
