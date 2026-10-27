// 作業ブランチとプランの連番 id（P1, P2, …）を扱う。git フックとブランチの作成から呼ばれる。
// - main（と master）へのコミットを止める（.githooks/pre-commit。作業は必ずブランチで行う。2026-10-18）
// - ブランチ名の id を、コミットメッセージの1行目の末尾に「 #P12」として付ける（.githooks/commit-msg）
// - 次の id を決めて、ブランチを切る
// id は「#P12」の形にする。「#12」だと GitHub が同じ番号の Issue・PR へのリンクにしてしまう。
// 1行目に付けるのは、git log --oneline で見えるようにするためと、メッセージの最後の段落の
// Co-Authored-By などのトレーラーを崩さないため。
//
// 使い方:
//   node scripts/branch-id.mjs new <種類> <名前> [--id P12]  # 次の id でブランチを切る（例：feat/P12-scenario-copy）。
//                                                             # 新しい id のときは、main のプランの後片付けの漏れで止める
//   node scripts/branch-id.mjs next                           # 次の id を出すだけ
//   node scripts/branch-id.mjs pre-commit                     # main へのコミットと、id の無いブランチでのコミットを止める
//   node scripts/branch-id.mjs commit-msg <ファイル>          # メッセージの1行目に id を付ける
// テストは scripts/branch-id.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { frontmatterValue } from './trace.mjs';

/** コミットを止めるブランチ */
export const PROTECTED_BRANCHES = ['main', 'master'];

/** ブランチの種類（manual-operations.md「サイクルを始める」） */
export const BRANCH_TYPES = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test'];

const BRANCH_ID = /(?:^|\/)P(\d+)-/;
const MESSAGE_ID = /#P(\d+)\b/g;
const PLAN_ID = /^\d{4}-\d{2}-\d{2}-P(\d+)-/;

/** ブランチ名の id（"P12"）。無ければ null */
export function branchId(branch) {
  const n = branch.match(BRANCH_ID)?.[1];
  return n ? `P${Number(n)}` : null;
}

/** プランのファイル名（docs/plans/<日付>-P<id>-<機能>.md）の id の番号。無ければ null */
export function planIdNumber(fileName) {
  const n = fileName.match(PLAN_ID)?.[1];
  return n ? Number(n) : null;
}

/** 使われている id の番号の最大に1を足した、次の id（"P13"）。何も無ければ P1 */
export function nextId({ branches = [], planFiles = [], messages = [] }) {
  const used = [
    ...branches
      .map((b) => branchId(b))
      .filter(Boolean)
      .map((id) => Number(id.slice(1))),
    ...planFiles.map(planIdNumber).filter((n) => n !== null),
    ...messages.flatMap((m) => [...m.matchAll(MESSAGE_ID)].map((x) => Number(x[1]))),
  ];
  return `P${Math.max(0, ...used) + 1}`;
}

/** ブランチ名を組み立てる。種類と名前がおかしければ例外 */
export function branchName(type, name, id) {
  if (!BRANCH_TYPES.includes(type))
    throw new Error(`ブランチの種類は ${BRANCH_TYPES.join('・')} のどれか（${type} は使えない）`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
    throw new Error(`ブランチの名前は英小文字・数字をハイフンでつなぐ（${name} は使えない）`);
  if (!/^P\d+$/.test(id)) throw new Error(`id は P と数字（${id} は使えない）`);
  return `${type}/${id}-${name}`;
}

/** コミットを止める理由（人が読むメッセージ）。通すなら null。branch は detached HEAD なら null */
export function checkCommitBranch({ branch, merging }) {
  // マージのコミット（衝突を解いた後の git commit）と、rebase などの detached HEAD は通す
  if (merging || branch === null) return null;
  if (PROTECTED_BRANCHES.includes(branch))
    return [
      `${branch} に直接コミットしない（作業はブランチで行う）。`,
      '  node scripts/branch-id.mjs new <種類> <名前>   # 例：node scripts/branch-id.mjs new docs fix-typo',
      'でブランチを切ってからコミットする（今の変更はそのまま持っていける）。',
      'docs のみの変更は、ブランチでコミットした後に main で git merge --ff-only <ブランチ> して push する（docs/process/manual-operations.md）。',
    ].join('\n');
  if (!branchId(branch))
    return [
      `ブランチ名に id がありません（${branch}）。コミットメッセージに id を付けられないので止めます。`,
      '  node scripts/branch-id.mjs new <種類> <名前>   # id 付きのブランチを切る',
      'か、git branch -m <種類>/P<番号>-<名前> で名前を変えてください。',
    ].join('\n');
  return null;
}

/** 後片付けを確かめるプランの日付の下限。これより前のプランは書き方がそろっていないので見ない（2026-10-27） */
export const CLOSEOUT_FROM = '2026-10-27';

/** 後片付けが済んでいない要望の状態（マージの後は完了・進行中・見送りのどれかにする） */
const OPEN_BACKLOG_STATUSES = ['未着手', '検討中', '判断待ち'];

/**
 * main に取り込まれたプランの後片付けの漏れを、人が読む行の配列で返す（無ければ空）。
 * plans は [{ file（docs/plans/ からの名前）, text }]、backlogStatus は要望の名前 → frontmatter の status。
 * 「PR 下書き」の節があるプランを、マージまで済んだものとみなす。マージの後に「人間レビューの結果」を書かず、
 * 要望の状態も直さないまま振り返りへ進むことが3回続いたため、次のサイクルのブランチを切る前に止める（2026-10-27）
 */
export function findUnclosedPlans(plans, backlogStatus) {
  const problems = [];
  for (const { file, text } of plans) {
    if (file.slice(0, 10) < CLOSEOUT_FROM || !/^## .*PR 下書き/m.test(text)) continue;
    if (!/^## .*人間レビューの結果/m.test(text))
      problems.push(`docs/plans/${file} に「人間レビューの結果」の節が無い`);
    const backlogLine = text.match(/^要望：.*$/m)?.[0] ?? '';
    for (const [, name] of backlogLine.matchAll(/\(\.\.\/backlog\/([^)#]+)\.md\)/g)) {
      const status = backlogStatus.get(name);
      if (OPEN_BACKLOG_STATUSES.includes(status))
        problems.push(
          `docs/backlog/${name}.md の status が「${status}」のまま（docs/plans/${file} はマージ済み）`,
        );
    }
  }
  return problems;
}

/** メッセージの1行目（# のコメント行と空行を飛ばした最初の行）の末尾に「 #P12」を付ける。付いていれば変えない */
export function appendId(message, id) {
  const lines = message.split('\n');
  const i = lines.findIndex((line) => line.trim() !== '' && !line.startsWith('#'));
  if (i === -1) return message;
  if ([...lines[i].matchAll(MESSAGE_ID)].length) return message;
  lines[i] = `${lines[i].trimEnd()} #${id}`;
  return lines.join('\n');
}

const git = (args) => spawnSync('git', args, { encoding: 'utf8' });

/** 今のブランチ名。detached HEAD なら null */
function currentBranch() {
  const r = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}

const merging = () => git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']).status === 0;

function collectUsed() {
  const lines = (r) => r.stdout.split('\n').filter(Boolean);
  return {
    branches: lines(git(['branch', '-a', '--format=%(refname:short)'])),
    planFiles: readdirSync('docs/plans'),
    messages: lines(git(['log', '--all', '--format=%s'])),
  };
}

function fail(message) {
  console.error(`[branch-id] ${message}`);
  process.exit(1);
}

function addIdToMessage(file) {
  const branch = currentBranch();
  const id = branch && !merging() ? branchId(branch) : null;
  if (!id) return;
  const message = readFileSync(file, 'utf8');
  const next = appendId(message, id);
  if (next !== message) writeFileSync(file, next);
}

/** main の docs/plans/ と docs/backlog/ を読む（作業中のブランチではなく、取り込まれたものを見る） */
function readMergedPlans() {
  const ls = (dir) =>
    git(['-c', 'core.quotePath=false', 'ls-tree', '--name-only', 'main', '--', dir])
      .stdout.split('\n')
      .filter(Boolean);
  const show = (path) => git(['show', `main:${path}`]).stdout;
  const plans = ls('docs/plans/')
    .filter((p) => p.endsWith('.md'))
    .map((p) => ({ file: p.slice('docs/plans/'.length), text: show(p) }));
  const backlogStatus = new Map(
    ls('docs/backlog/')
      .filter((p) => p.endsWith('.md'))
      .map((p) => [p.slice('docs/backlog/'.length, -3), frontmatterValue(show(p), 'status')]),
  );
  return { plans, backlogStatus };
}

function createBranch(args) {
  const [type, name] = args;
  const idFlag = args.indexOf('--id');
  // 新しい id を切るときだけ、前のサイクルの後片付けを確かめる（--id で同じ id の続きを切るときは、その後片付けをするため止めない）
  if (idFlag === -1) {
    const { plans, backlogStatus } = readMergedPlans();
    const problems = findUnclosedPlans(plans, backlogStatus);
    if (problems.length)
      fail(
        [
          'マージ済みのサイクルの後片付けが済んでいません。',
          ...problems.map((p) => `  - ${p}`),
          '同じ id のブランチ（node scripts/branch-id.mjs new docs <名前> --id P<id>）で、プランに「人間レビューの結果」の節を書き、',
          '要望の status・cycles・updated を直して main に取り込んでから、次のブランチを切ってください（docs/process/index.md の手順8）。',
        ].join('\n'),
      );
  }
  const id = idFlag === -1 ? nextId(collectUsed()) : args[idFlag + 1];
  let branch;
  try {
    branch = branchName(type, name, id);
  } catch (e) {
    fail(e.message);
  }
  const r = git(['switch', '-c', branch]);
  if (r.status !== 0) fail(r.stderr.trim());
  console.log(`${branch} を切りました（id ${id}。プランは docs/plans/<日付>-${id}-<機能>.md）`);
}

function main([command, ...args]) {
  switch (command) {
    case 'pre-commit': {
      const error = checkCommitBranch({ branch: currentBranch(), merging: merging() });
      if (error) fail(error);
      return;
    }
    case 'commit-msg':
      addIdToMessage(args[0]);
      return;
    case 'next':
      console.log(nextId(collectUsed()));
      return;
    case 'new':
      createBranch(args);
      return;
    default:
      fail(
        '使い方: node scripts/branch-id.mjs new <種類> <名前> [--id P12] | next | pre-commit | commit-msg <ファイル>',
      );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
