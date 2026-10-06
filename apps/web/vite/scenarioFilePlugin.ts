// 開発サーバーの書き込みの口：公開したシナリオを scenarios/<id>.json に書く
// （docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md。使い方は docs/architecture/web-app.md「ローカル開発の注意」）。
//
// vite.config.ts は Vite が束ねて Node で読むので、ここでは @cartagraph/domain も @/ も静的に import しない
// （domain の中の拡張子を省いた import を Node が解決できず、設定の読み込みで落ちる）。domain の検査は
// configureServer の中で server.ssrLoadModule で読む。ここで使うのは node: の標準モジュールだけ。
// ログは server.config.logger を使う（console は Biome の noConsole で止まる）。

import { spawn } from 'node:child_process';
import { rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';

/** Vite の normalizePath と同じ（区切りを / に）。vite 本体はテスト（jsdom）で読むと esbuild が落ちるので import しない */
const normalizePath = (p: string) => p.replace(/\\/g, '/');

/** 口の URL。BASE_URL を付けない絶対パス（mocks/devScenarioFileStore.ts と揃える） */
export const SCENARIO_FILE_ENDPOINT = '/__dev/scenarios';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** エージェントの確認用の開発サーバー（pnpm web:dev:agent）のポート。既定で口を閉じる（プランの D10） */
const AGENT_PORT = 5174;

// new URL(相対, import.meta.url) の形は、Vite（Vitest）がアセットの URL に書き換えるので使わない
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

export type ScenarioCheck = (
  path: string,
  raw: unknown,
) => { ok: true } | { ok: false; message: string };
/** path はリポジトリからの相対パス（Biome の設定の当て方を決める）、text は整形前の JSON */
export type ScenarioFormat = (path: string, text: string) => Promise<string>;

export type ScenarioPutRequest = {
  method: string | undefined;
  contentType: string | undefined;
  id: string;
  body: string;
  remoteAddress: string | undefined;
};

export type ScenarioPutResponse = { status: number; body?: string };

export type ScenarioPutDeps = {
  scenariosDir: string;
  /** ファイルにできる id（domain の scenarioFileIdPattern。MSW の検査と口の検査をそろえる） */
  idPattern: RegExp;
  check: ScenarioCheck;
  format: ScenarioFormat;
};

let tempSeq = 0;

/**
 * 一時ファイルのパス。書き込みごとに名前を変える（同じ id の書き込みが重なっても、互いの一時ファイルを上書きしない）。
 * .json で終わらないので glob に拾われない
 */
export function tempPathFor(scenariosDir: string, id: string): string {
  return join(scenariosDir, `.${id}.json.${process.pid}-${++tempSeq}.tmp`);
}

/** Biome の整形を待つ上限。返らないと画面が「保存中…」のまま止まるため */
const FORMAT_TIMEOUT_MS = 10_000;

/** ミドルウェアに届く URL（口の接頭辞を除いたもの。例 /sc-1?x=1）から id を取り出す。デコードはしない */
export function scenarioIdFromUrl(url: string | undefined): string {
  return (url ?? '').replace(/\?.*$/, '').replace(/^\//, '');
}

/**
 * 口の処理。依存（scenariosDir・idPattern・check・format）は必須（既定値を持たせず、テストがリポジトリへ書く経路を作らない）。
 * 書き込みは同じディレクトリの一時ファイルに書いてから rename で置き換える（途中で止まっても壊れた JSON を残さない。
 * 一時ファイルは .json で終わらないので glob に拾われない）。
 */
export async function handleScenarioPut(
  req: ScenarioPutRequest,
  deps: ScenarioPutDeps,
): Promise<ScenarioPutResponse> {
  if (req.method !== 'PUT') return { status: 405, body: 'PUT だけを受け付ける' };
  if (!req.remoteAddress || !LOOPBACK.has(req.remoteAddress)) {
    return { status: 403, body: 'シナリオの書き込みは localhost で開いた画面からだけできる' };
  }
  if (!req.contentType?.split(';')[0]?.trim().toLowerCase().startsWith('application/json')) {
    return { status: 415, body: 'Content-Type は application/json にする' };
  }
  if (!deps.idPattern.test(req.id)) {
    return { status: 400, body: `id「${req.id}」は、英小文字・数字・ハイフンだけにする` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(req.body);
  } catch {
    return { status: 400, body: '本文が JSON として読めない' };
  }
  const path = `scenarios/${req.id}.json`;
  const checked = deps.check(path, raw);
  if (!checked.ok) return { status: 422, body: checked.message };

  const target = join(deps.scenariosDir, `${req.id}.json`);
  const temp = tempPathFor(deps.scenariosDir, req.id);
  try {
    const text = await deps.format(path, JSON.stringify(raw, null, 2));
    await writeFile(temp, text);
    await rename(temp, target);
  } catch (e) {
    await rm(temp, { force: true });
    return { status: 500, body: `${path} を書けなかった：${(e as Error).message}` };
  }
  return { status: 204 };
}

/**
 * Biome（JSON の整形の正）で整形する。リポジトリ直下を cwd にし、stdin で渡す。--stdin-file-path は
 * 書き込み先に関係なく、リポジトリからの相対パスにする（別のパスを渡すと、Biome は違う設定で整形する）。
 * シェルを使わず node で Biome を起動する（Windows で pnpm exec をシェル経由で呼ばない）。
 * timeoutMs までに返らなければ止めて失敗にする。
 */
export function createBiomeFormatter(timeoutMs = FORMAT_TIMEOUT_MS): ScenarioFormat {
  const biome = createRequire(join(repoRoot, 'package.json')).resolve('@biomejs/biome/bin/biome');
  return (path, text) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [biome, 'format', `--stdin-file-path=${path}`], {
        cwd: repoRoot,
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`biome format が ${timeoutMs}ms で返らなかった`));
      }, timeoutMs);
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      child.stdout.on('data', (b: Buffer) => out.push(b));
      child.stderr.on('data', (b: Buffer) => err.push(b));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(Buffer.concat(out).toString('utf8'));
        else
          reject(
            new Error(`biome format が失敗した（${code}）：${Buffer.concat(err).toString('utf8')}`),
          );
      });
      // Biome が読み切る前に止まると（時間切れの kill、設定の誤りですぐ終わる）stdin に EPIPE が出る。受けないと
      // 開発サーバーごと落ちるので受けておく（失敗の判定は close・error・時間切れに任せる）
      child.stdin.on('error', () => undefined);
      child.stdin.end(text);
    });
}

/** 口が直前に書いたファイルの HMR を止める（全体リロードで、メモリ上の募集・セッションと知らせが消えるため） */
export function createHmrGuard(now: () => number = Date.now, windowMs = 2000) {
  const written = new Map<string, number>();
  return {
    record(file: string) {
      written.set(normalizePath(file), now());
    },
    /** Windows では change が2回届くことがあるので、1回で記録を消さず、時間で消す */
    shouldSuppress(file: string): boolean {
      const key = normalizePath(file);
      const at = written.get(key);
      if (at === undefined) return false;
      if (now() - at > windowMs) {
        written.delete(key);
        return false;
      }
      return true;
    },
  };
}

/** 口を開くか（プランの D10）。build・preview・Vitest では開かない。エージェント用のポートは環境変数で開く */
export function scenarioFileWriteOpen(o: {
  command: 'serve' | 'build';
  isPreview: boolean | undefined;
  vitest: boolean;
  port: number | undefined;
  env: Record<string, string | undefined>;
}): boolean {
  if (o.command !== 'serve' || o.isPreview || o.vitest) return false;
  if (o.port === AGENT_PORT) return o.env.CARTAGRAPH_WRITE_SCENARIOS === '1';
  return true;
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (b: Buffer) => chunks.push(b));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * 口のプラグイン。口が開いているかを __SCENARIO_FILE_WRITE__ でブラウザ側（mocks/browser.ts）へ渡す
 * （閉じていれば、ブラウザはデモと同じ「保存されません」になる）。
 */
export function scenarioFilePlugin(): Plugin {
  let open = false;
  const guard = createHmrGuard();
  const scenariosDir = join(repoRoot, 'scenarios');
  const scenarioFilesModule = normalizePath(resolve(here, '../src/mocks/scenarioFiles.ts'));

  return {
    name: 'cartagraph:scenario-file',
    config(userConfig, env) {
      open = scenarioFileWriteOpen({
        command: env.command,
        isPreview: env.isPreview,
        vitest: Boolean(process.env.VITEST),
        port: userConfig.server?.port,
        env: process.env,
      });
      return { define: { __SCENARIO_FILE_WRITE__: JSON.stringify(open) } };
    },
    configureServer(server: ViteDevServer) {
      if (!open) return;
      const format = createBiomeFormatter();
      server.middlewares.use(SCENARIO_FILE_ENDPOINT, (req, res) => {
        void (async () => {
          const { safeParseScenarioFile, scenarioFileIdPattern } = (await server.ssrLoadModule(
            '@cartagraph/domain/scenario/file',
          )) as { safeParseScenarioFile: ScenarioCheck; scenarioFileIdPattern: RegExp };
          const id = scenarioIdFromUrl(req.url);
          // 書く前に記録する。rename の直後に変更の通知が届き、書き終えてから記録したのでは間に合わないことがある
          // （書けなかったときは、そのパスの HMR を少しの間止めるだけで害は無い）
          if (scenarioFileIdPattern.test(id)) guard.record(join(scenariosDir, `${id}.json`));
          const result = await handleScenarioPut(
            {
              method: req.method,
              contentType: req.headers['content-type'],
              id,
              body: await readBody(req),
              remoteAddress: req.socket.remoteAddress,
            },
            {
              scenariosDir,
              idPattern: scenarioFileIdPattern,
              check: safeParseScenarioFile,
              format,
            },
          );
          if (result.status === 204) {
            // 新しいファイルは監視していないので HMR は起きない。次に手でリロードしたとき glob を作り直させる
            for (const mod of server.environments.client.moduleGraph.getModulesByFile(
              scenarioFilesModule,
            ) ?? []) {
              server.environments.client.moduleGraph.invalidateModule(mod);
            }
            server.config.logger.info(`scenarios/${id}.json に保存した`, { timestamp: true });
          } else {
            server.config.logger.warn(`scenarios/${id}.json を保存しなかった（${result.status}）`, {
              timestamp: true,
            });
          }
          res.statusCode = result.status;
          if (result.body !== undefined) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(result.body);
          } else {
            res.end();
          }
        })().catch((e: unknown) => {
          res.statusCode = 500;
          res.end((e as Error).message);
        });
      });
    },
    hotUpdate: {
      order: 'post',
      handler({ file }) {
        if (guard.shouldSuppress(file)) return [];
      },
    },
  };
}
