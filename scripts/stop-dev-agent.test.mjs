// stop-dev-agent.mjs の、止めてよいプロセスかの判定（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAgentPreview, isAgentVite } from './stop-dev-agent.mjs';

describe('isAgentPreview', () => {
  it('vite preview を --port 4174 で起動したものは止めてよい', () => {
    assert.ok(
      isAgentPreview(
        'node   "D:\\p\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js" "preview" "--port" "4174" "--strictPort"',
      ),
    );
    assert.ok(isAgentPreview('node /p/node_modules/.bin/vite preview --port 4174'));
  });

  it('E2E の preview（4173）・preview でない vite・別のポートは止めない', () => {
    assert.ok(!isAgentPreview('node /p/node_modules/.bin/vite preview --port 4173'));
    assert.ok(!isAgentPreview('node /p/node_modules/.bin/vite preview'));
    assert.ok(!isAgentPreview('node /p/node_modules/.bin/vite --port 4174'));
  });
});

describe('isAgentVite', () => {
  it('vite を --port 5174 で起動したものは止めてよい（Windows・Unix の書き方）', () => {
    assert.ok(
      isAgentVite(
        'node   "D:\\p\\apps\\web\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js" "--port" "5174"',
      ),
    );
    assert.ok(isAgentVite('node /p/node_modules/.bin/vite --port 5174'));
    assert.ok(isAgentVite('node /p/node_modules/.bin/vite --port=5174'));
  });

  it('人間の開発サーバー（ポート指定なし＝5173）・別のポート・vite でないものは止めない', () => {
    assert.ok(!isAgentVite('node "D:\\p\\node_modules\\vite\\bin\\vite.js"'));
    assert.ok(!isAgentVite('node /p/node_modules/.bin/vite --port 51740'));
    assert.ok(!isAgentVite('node /p/node_modules/.bin/vite --port 5173'));
    assert.ok(!isAgentVite('node server.js --port 5174'));
  });
});
