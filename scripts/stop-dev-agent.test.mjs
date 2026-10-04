// stop-dev-agent.mjs の、止めてよいプロセスかの判定（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAgentVite } from './stop-dev-agent.mjs';

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
