import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, test } from 'node:test';
import { normalizeActors, parseTestFile, parseUseCases, USE_CASES_FILE } from './usecases.mjs';

const COLUMNS_MD = `## シナリオ製作

| ID | ユースケース | アクター | 画面 | 書き換える集約 | 起きるイベント |
|---|---|---|---|---|---|
| SC-6 | 公開する | シナリオ製作者 | \`/creator/scenarios/:scenarioId\`・GM のホーム | シナリオ | シナリオを公開した・シナリオ集から外した |
| SC-5 | 行き止まり | シナリオ製作者・GM | \`/gm/scenarios\` | （読むだけ） | — |
| SC-9 | 自動 | GM（自動解決ならシステム） | — | — | — |

## プレイ

| ID | 画面 | ユースケース | 起きるイベント | 書き換える集約 | アクター |
|---|---|---|---|---|---|
| PL-2 | \`/pl/play\` | プレイする | 結末に達した | セッションスナップショット | ドライバー |

## グラフ（将来）

| ID | ユースケース | アクター | 起きること |
|---|---|---|---|
| GR-5 | 取り込む | （セッションの正常終了） | PC 発見グラフが増える |
`;

const MD = `# 中核のユースケース

## シナリオ製作

| ID | ユースケース | アクター | 書き換える集約 | 起きるイベント |
|---|---|---|---|---|
| SC-1 | 下書きを作る | シナリオ製作者 | シナリオ | — |
| SC-2 | シナリオデッキを組む | シナリオ製作者 | シナリオ | — |

### SC-1 下書きを作る

- **ほかの流れ** — SC-2・SC-6 の検査で止まる

## グラフ（将来）

| ID | ユースケース | アクター | 起きること |
|---|---|---|---|
| GR-1 | システム全体の構造を見る | システム製作者 | — |
`;

test('T1: 5列・4列の表の行から ID・名前・業務領域を読む。ヘッダ・区切り・見出し・本文は読まない', () => {
  const list = parseUseCases(MD);
  assert.deepEqual(
    list.map((u) => [u.id, u.name, u.domain]),
    [
      ['SC-1', '下書きを作る', 'シナリオ製作'],
      ['SC-2', 'シナリオデッキを組む', 'シナリオ製作'],
      ['GR-1', 'システム全体の構造を見る', 'グラフ'],
    ],
  );
});

test('T2: （将来）の業務領域を将来として読む。1件も読めない・同じ ID が2回出るときは誤り', () => {
  const list = parseUseCases(MD);
  assert.deepEqual(
    list.map((u) => u.future),
    [false, false, true],
  );
  assert.throws(() => parseUseCases('# 表が無い\n\n| ID | 名前 |\n|---|---|\n'), /1件も読めない/);
  assert.throws(() => parseUseCases(`${MD}\n| SC-1 | 重複 | a | b | c |\n`), /SC-1 が2回/);
});

test('T2: 実際の use-cases.md を読める', () => {
  const list = parseUseCases(readFileSync(USE_CASES_FILE, 'utf8'));
  assert.ok(list.some((u) => u.id === 'SC-1' && !u.future));
  assert.ok(list.some((u) => u.id === 'PL-8'));
  assert.ok(list.some((u) => u.id === 'GR-1' && u.future));
  assert.ok(list.some((u) => u.id === 'EV-6' && u.future));
});

test('T3: タグを読む（配列・複数行・文字列1つ・ダブルクォート）', () => {
  const t = parseTestFile(`
    test('a', { tag: ['@SC-1', '@SC-2',
      '@SC-10'] }, async () => {});
  `);
  assert.deepEqual(t.tags, ['SC-1', 'SC-2', 'SC-10']);
  assert.deepEqual(parseTestFile(`test('a', { tag: '@SC-1' }, async () => {});`).tags, ['SC-1']);
  assert.deepEqual(parseTestFile(`test("a", { tag: ["@PL-2"] }, async () => {});`).tags, ['PL-2']);
});

test('T3: ID でないタグは読まない。小文字は形の違うタグ。コメントアウトした行は読まない', () => {
  const t = parseTestFile(`
    test('a', { tag: ['@slow', '@sc-1', '@SC-1'] }, async () => {});
    // test('b', { tag: ['@SC-9'] }, async () => {});
    /* test.step('SC-8 コメント', async () => {}); */
    const url = 'http://example.com'; // test.step('SC-7 末尾のコメント', async () => {});
  `);
  assert.deepEqual(t.tags, ['SC-1']);
  assert.deepEqual(t.badTags, ['@sc-1']);
  assert.deepEqual(t.stepIds, []);
  assert.equal(t.testCount, 1);
});

test('T4: ステップの題の先頭の ID を読む。ID の無い題・空白の無い題・途中の ID は読まない', () => {
  const t = parseTestFile(`
    await test.step('SC-1 下書きを作る', async () => {});
    await test.step("PL-2 手札を出す", async () => {});
    await test.step('下ごしらえ', async () => {});
    await test.step('SC-3下書き', async () => {});
    await test.step('GM 不在で PL-2 を確かめる', async () => {});
    await test.step('sc-4 小文字', async () => {});
  `);
  assert.deepEqual(t.stepIds, ['SC-1', 'PL-2']);
  assert.deepEqual(t.badSteps, ['sc-4 小文字']);
  assert.equal(t.nonLiteralSteps, 0);
});

test('T7: 文字列の直書きでない test.step・題のタグ・describe のタグ・skip 系を読む', () => {
  const t = parseTestFile(`
    test.describe('群', { tag: ['@SC-1'] }, () => {
      test('題 @SC-1', async () => {
        await test.step(\`SC-1 \${x}\`, async () => {});
        await test.step(title, async () => {});
        await test.step.skip('SC-2 飛ばす', async () => {});
        expect.soft(1).toBe(1);
        test.skip(isMobile, '理由');
      });
      test.fixme('c', async () => {});
    });
  `);
  assert.equal(t.describeTagged, true);
  assert.equal(t.titleTagged, true);
  assert.equal(t.nonLiteralSteps, 2);
  assert.deepEqual([...new Set(t.forbidden)].sort(), [
    'expect.soft',
    'test.fixme',
    'test.skip',
    'test.step.skip',
  ]);
  assert.equal(t.testCount, 1);
  assert.deepEqual(t.skips, []);
});

const BACKLOG = "{ type: 'backlog', description: 'docs/backlog/fix.md' }";

describe('T1: 宣言のスキップと注記', () => {
  it('宣言の test.skip を、テスト1本・タグの持ち主・skips・backlogs として読む', () => {
    const t = parseTestFile(`
      // biome-ignore lint/suspicious/noSkippedTests: 不安定なため。直す要望は annotation
      test.skip('題', { tag: ['@PL-1', '@PL-2'], annotation: ${BACKLOG} }, async () => {
        await test.step('PL-1 a', async () => {});
      });
    `);
    assert.equal(t.testCount, 1);
    assert.deepEqual(t.tags, ['PL-1', 'PL-2']);
    assert.equal(t.describeTagged, false);
    assert.deepEqual(t.forbidden, []);
    assert.deepEqual(t.skips, [{ backlogCount: 1 }]);
    assert.deepEqual(t.backlogs, [{ description: 'docs/backlog/fix.md', skipped: true }]);
    assert.equal(t.unreadableAnnotations, 0);
    assert.equal(t.danglingSkipSuppressions, 0);
  });

  it('注記は配列でも、キーの順が逆でも読む。backlog 以外の注記は backlogs に入れない', () => {
    const t = parseTestFile(`
      test.skip("題", {
        annotation: [
          { type: 'issue', description: 'https://example.com/1' },
          { description: "docs/backlog/fix.md", type: "backlog" },
        ],
        tag: ['@PL-1'],
      }, async () => {});
    `);
    assert.deepEqual(t.skips, [{ backlogCount: 1 }]);
    assert.deepEqual(t.backlogs, [{ description: 'docs/backlog/fix.md', skipped: true }]);
    assert.equal(t.unreadableAnnotations, 0);
  });

  it('Biome の整形で題が次の行に回る形も読む', () => {
    const t = parseTestFile(`
      // biome-ignore lint/suspicious/noSkippedTests: 不安定なため。直す要望は annotation
      test.skip(
        'とても長い題',
        {
          tag: ['@PL-1'],
          annotation: {
            type: 'backlog',
            description: 'docs/backlog/fix.md',
          },
        },
        async ({ page }) => {},
      );
    `);
    assert.equal(t.testCount, 1);
    assert.deepEqual(t.tags, ['PL-1']);
    assert.deepEqual(t.skips, [{ backlogCount: 1 }]);
    assert.equal(t.danglingSkipSuppressions, 0);
  });

  it('題の中のタグを拾う。スキップしていないテストの backlog の注記は skipped: false', () => {
    assert.equal(parseTestFile(`test.skip('題 @PL-1', {}, async () => {});`).titleTagged, true);
    const t = parseTestFile(`test('題', { annotation: ${BACKLOG} }, async () => {});`);
    assert.deepEqual(t.skips, []);
    assert.deepEqual(t.backlogs, [{ description: 'docs/backlog/fix.md', skipped: false }]);
  });

  it('今どおり forbidden：本文の中の条件付き・テンプレート文字列の題・fixme・describe.skip・step.skip', () => {
    const forbiddenOf = (source) => parseTestFile(source).forbidden;
    assert.deepEqual(forbiddenOf('test.skip();'), ['test.skip']);
    assert.deepEqual(forbiddenOf("test.skip(cond, '理由');"), ['test.skip']);
    assert.deepEqual(forbiddenOf('test.skip(`題`, {}, async () => {});'), ['test.skip']);
    assert.deepEqual(forbiddenOf(`test.fixme('題', { annotation: ${BACKLOG} }, fn);`), [
      'test.fixme',
    ]);
    assert.deepEqual(forbiddenOf("test.describe.skip('題', fn);"), ['test.describe.skip']);
    assert.deepEqual(forbiddenOf("await test.step.skip('PL-1 a', fn);"), ['test.step.skip']);
    assert.deepEqual(parseTestFile('test.skip(`題`, {}, async () => {});').skips, []);
  });

  it('直書きでない annotation・type・description は unreadableAnnotations', () => {
    const unreadable = (annotation) =>
      parseTestFile(`test.skip('題', { annotation: ${annotation} }, async () => {});`)
        .unreadableAnnotations;
    assert.equal(unreadable('notes'), 1);
    assert.equal(
      unreadable(["{ type: 'backlog', description: `docs/backlog/$", '{x}.md` }'].join('')),
      1,
    );
    assert.equal(unreadable("{ type: kind, description: 'docs/backlog/fix.md' }"), 1);
    assert.equal(
      unreadable("[{ type: 'backlog', description: 'docs/backlog/fix.md' }, ...more]"),
      1,
    );
    assert.equal(unreadable(BACKLOG), 0);
  });

  it('抑制コメントの次の文が宣言の test.skip( でなければ danglingSkipSuppressions', () => {
    const dangling = (source) => parseTestFile(source).danglingSkipSuppressions;
    const ignore = '// biome-ignore lint/suspicious/noSkippedTests: 不安定なため';
    assert.equal(dangling(`${ignore}\ntest('題', {}, async () => {});`), 1);
    assert.equal(dangling(`${ignore}\n\ntest.skip('題', {}, async () => {});`), 0);
    assert.equal(dangling(`${ignore}\ntest.skip(cond, '理由');`), 1);
  });
});

test('T3: 画面・アクター・集約・イベントの列を見出しの名前で読む（列の順が違っても読める）', () => {
  const byId = Object.fromEntries(parseUseCases(COLUMNS_MD).map((u) => [u.id, u]));
  assert.deepEqual(byId['SC-6'].screens, ['/creator/scenarios/:scenarioId', 'GM のホーム']);
  assert.deepEqual(byId['SC-6'].aggregates, ['シナリオ']);
  assert.deepEqual(byId['SC-6'].events, ['シナリオを公開した', 'シナリオ集から外した']);
  assert.deepEqual(byId['PL-2'].screens, ['/pl/play']);
  assert.deepEqual(byId['PL-2'].aggregates, ['セッションスナップショット']);
  assert.deepEqual(byId['PL-2'].events, ['結末に達した']);
  assert.deepEqual(byId['PL-2'].actors, ['ドライバー']);
  assert.equal(byId['PL-2'].name, 'プレイする');
});

test('T3: —（画面・イベント）と（読むだけ）（集約）は空。将来の表は画面・集約・イベントが空で読める', () => {
  const byId = Object.fromEntries(parseUseCases(COLUMNS_MD).map((u) => [u.id, u]));
  assert.deepEqual(byId['SC-5'].aggregates, []);
  assert.deepEqual(byId['SC-5'].events, []);
  assert.deepEqual(byId['SC-9'].screens, []);
  assert.deepEqual(byId['GR-5'].screens, []);
  assert.deepEqual(byId['GR-5'].aggregates, []);
  assert.deepEqual(byId['GR-5'].events, []);
  assert.equal(byId['GR-5'].future, true);
});

test('アクター・集約・イベントの列が無い表は、アクターを「システム」にせず、空で読む', () => {
  const md = '## 表\n\n| ID | ユースケース | 画面 |\n|---|---|---|\n| SC-1 | 下書き | `/a` |\n';
  const [u] = parseUseCases(md);
  assert.deepEqual([u.actors, u.aggregates, u.events], [[], [], []]);
  assert.deepEqual(u.columns, ['ID', 'ユースケース', '画面']);
});

test('T4: アクターの正規化（・で区切る／（…）を除く／注記だけはシステム／誰でもはそのまま）', () => {
  assert.deepEqual(normalizeActors('シナリオ製作者・GM'), ['シナリオ製作者', 'GM']);
  assert.deepEqual(normalizeActors('GM（自動解決ならシステム）'), ['GM']);
  assert.deepEqual(normalizeActors('（セッションの正常終了）'), ['システム']);
  assert.deepEqual(normalizeActors('誰でも'), ['誰でも']);
  assert.deepEqual(normalizeActors('GM・PL（後から誰でも）'), ['GM', 'PL']);
  const byId = Object.fromEntries(parseUseCases(COLUMNS_MD).map((u) => [u.id, u]));
  assert.deepEqual(byId['SC-9'].actors, ['GM']);
  assert.deepEqual(byId['GR-5'].actors, ['システム']);
});
