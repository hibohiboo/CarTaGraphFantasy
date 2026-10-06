// エージェント用の開発サーバー（pnpm web:dev:agent、5174 番）と、エージェントが確かめに使う preview（4174 番）を止める。バックグラウンドのタスクを止めても
// （時間切れも含む）、Windows では vite の子プロセスが残り 5174 番を使い続けるため（2026-10-05、PR #16 の振り返り）。
// 5174 番を待ち受けるプロセスが vite で --port 5174 のときだけ止め、ほかのプロセスには触らない。
//
// 使い方: pnpm web:dev:agent:stop
// テストは scripts/stop-dev-agent.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const AGENT_PORT = 5174;
/** エージェントが build の確かめに使う vite preview のポート（E2E の 4173 とは分ける） */
export const AGENT_PREVIEW_PORT = 4174;

/** そのコマンドラインが、エージェント用の開発サーバー（vite を --port 5174 で起動したもの）か */
export function isAgentVite(commandLine, port = AGENT_PORT) {
  return (
    /vite(\.js)?\b/.test(commandLine) && new RegExp(`--port[\\s"'=]+${port}\\b`).test(commandLine)
  );
}

/** そのコマンドラインが、エージェントの preview（vite preview を --port 4174 で起動したもの）か */
export function isAgentPreview(commandLine, port = AGENT_PREVIEW_PORT) {
  return /\bpreview\b/.test(commandLine) && isAgentVite(commandLine, port);
}

/** ポートを待ち受けるプロセスの PID とコマンドライン（無ければ null） */
function listener(port) {
  if (process.platform === 'win32') {
    const script = `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"; "$($p.ProcessId)\`t$($p.CommandLine)" }`;
    const r = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    const [pid, ...cmd] = (r.stdout ?? '').trim().split('\t');
    return pid ? { pid: Number(pid), commandLine: cmd.join('\t') } : null;
  }
  const pid = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8',
  })
    .stdout?.trim()
    .split('\n')[0];
  if (!pid) return null;
  const cmd = spawnSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' }).stdout?.trim();
  return { pid: Number(pid), commandLine: cmd ?? '' };
}

/** ポートを待ち受けるのが止めてよいプロセスなら止める。止めてはいけないプロセスなら false */
function stop(port, isOurs, label) {
  const found = listener(port);
  if (!found) {
    console.log(`${port} 番を待ち受けるプロセスはありません`);
    return true;
  }
  if (!isOurs(found.commandLine)) {
    console.error(`${port} 番は${label}ではないので、止めません: ${found.commandLine}`);
    return false;
  }
  process.kill(found.pid);
  console.log(`${label}を止めました（pid ${found.pid}）`);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dev = stop(AGENT_PORT, (c) => isAgentVite(c), 'エージェント用の開発サーバー');
  const preview = stop(AGENT_PREVIEW_PORT, (c) => isAgentPreview(c), 'エージェント用の preview');
  if (!dev || !preview) process.exit(1);
}
