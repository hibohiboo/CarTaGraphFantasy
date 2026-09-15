// `pnpm install` の prepare フックから呼ばれ、このリポジトリの git フック置き場
// （.githooks/）を core.hooksPath に設定する。Windows/Git Bash・macOS・Linux のどれでも
// 動くよう Node.js で書く（シェルスクリプトは環境差が出やすいため）。
// git 管理下でない環境（tarball 展開など）では何もせず正常終了する。
import { execFileSync } from 'node:child_process';

function run(args) {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

try {
  run(['rev-parse', '--git-dir']);
} catch {
  // git リポジトリでない（npm パッケージとしての展開など）。何もしない。
  process.exit(0);
}

try {
  const current = (() => {
    try {
      return run(['config', '--local', 'core.hooksPath']);
    } catch {
      return '';
    }
  })();

  if (current !== '.githooks') {
    run(['config', '--local', 'core.hooksPath', '.githooks']);
    console.log('[setup-git-hooks] core.hooksPath を .githooks に設定しました');
  }
} catch (err) {
  // フック設定に失敗しても install 自体は止めない（手動で
  // `git config --local core.hooksPath .githooks` を実行すればよい）。
  console.warn('[setup-git-hooks] core.hooksPath の設定に失敗しました。手動で実行してください:');
  console.warn('  git config --local core.hooksPath .githooks');
  console.warn(String(err?.message ?? err));
}
