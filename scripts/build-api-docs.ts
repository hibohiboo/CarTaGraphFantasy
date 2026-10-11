// API ドキュメントを作る（docs/plans/2026-10-11-APIドキュメント.md G4）。`pnpm api:docs` で流す。
// packages/schemas の API の一覧から OpenAPI の文書を作って docs/.vitepress/dist/api-docs/openapi.json に書き、
// redocly lint（設定は redocly.yaml。誤りが1件でもあれば失敗）を通してから、Redoc の HTML 1枚（index.html）にする。
// dist は pnpm docs:build が作り直すので、その後に流す（build:pages・CI・pre-push はその順で流す）。
// 中身は packages/schemas の api/openapi.ts（テストは schemas:test）。ここは書き出しと CLI の呼び出しだけ。

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../packages/schemas/src/api/openapi';

// どこから流しても、リポジトリの docs/.vitepress/dist/api-docs/ に書く
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'docs', '.vitepress', 'dist', 'api-docs');
const SPEC = join(OUT_DIR, 'openapi.json');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(SPEC, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`wrote ${SPEC}`);

// Windows では .cmd のシムを shell 無しで起動できないので、CLI の本体を node で直接流す
const cli = createRequire(import.meta.url).resolve('@redocly/cli/bin/cli.js');
const env = { ...process.env, REDOCLY_TELEMETRY: 'off', REDOCLY_SUPPRESS_UPDATE_NOTICE: 'true' };

function redocly(args: string[]): void {
  const r = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env });
  if (r.error) {
    console.error(`redocly ${args[0]} を起動できませんでした：${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`redocly ${args[0]} が失敗しました（終了コード ${r.status ?? r.signal}）`);
    process.exit(1);
  }
}

// 設定は今いるディレクトリから探されるので、明示する
const CONFIG = join(ROOT, 'redocly.yaml');

redocly(['lint', SPEC, '--config', CONFIG]);
redocly([
  'build-docs',
  SPEC,
  '--config',
  CONFIG,
  '--output',
  join(OUT_DIR, 'index.html'),
  '--title',
  'カルタグラフ API',
  '--disableGoogleFont',
]);
