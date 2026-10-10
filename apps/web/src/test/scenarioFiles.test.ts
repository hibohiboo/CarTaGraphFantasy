// scenarios/*.json の読み込みと、fixtures との関係（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// 遊べるシナリオの正は scenarios/*.json。fixtures に残る重複（灰色館の一夜の手札）は、統合するまでずれをここで検知する。
// お店の戦闘スキルと試験官の重複は、rules/ のカード一覧と JSON からの読み込みで1か所になった（rulesFiles.test.ts。
// docs/plans/2026-10-10-ルールとカードプールのJSON管理.md）。

import { toScenarioFile } from '@cartagraph/domain/scenario/file';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import { scenarioSchema } from '@cartagraph/domain/scenario/model';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { scenarios, sessions } from '../mocks/fixtures';
import { playScript } from '../mocks/handlers';
import { scenarioFiles } from '../mocks/scenarioFiles';

const rawFiles = import.meta.glob('../../../../scenarios/*.json', {
  eager: true,
  import: 'default',
});

const byId = (id: string) => {
  const s = scenarios.find((x) => x.id === id);
  if (!s) throw new Error(`${id} がありません`);
  return s;
};

// 開発サーバーで公開したシナリオ（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）をコミットしても
// 落ちないよう、ファイルの数は固定しない。元からある4本は名指しで確かめる（glob の空振りも検知する）。
const ORIGINAL_FILES = ['sc-corridor-after', 'sc-galleon', 'sc-gray-mansion', 'sc-village-start'];
const fileIds = () => scenarioFiles.map((s) => s.id);

describe('scenarios/*.json の読み込み', () => {
  it('元からある4本を含み、id 順に読む', () => {
    expect(fileIds()).toEqual(expect.arrayContaining(ORIGINAL_FILES));
    expect(fileIds()).toEqual([...fileIds()].sort((a, b) => a.localeCompare(b)));
    expect(Object.keys(rawFiles)).toHaveLength(scenarioFiles.length);
  });

  it('検査を通しても、JSON の中身もキーの順も変わらない（書き直しでキーの並べ替えの差分を出さない）', () => {
    for (const raw of Object.values(rawFiles)) {
      expect(scenarioSchema.parse(raw)).toEqual(raw);
      expect(JSON.stringify(scenarioSchema.parse(raw))).toBe(JSON.stringify(raw));
    }
  });

  it('画像の無い JSON は、ファイルに書く形（toScenarioFile）にしても変わらない', () => {
    for (const s of scenarioFiles) expect(toScenarioFile(s)).toEqual(s);
  });

  it('fixtures のシナリオは、JSON・下書き・テスト専用の順で、id が重複しない', () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, scenarioFiles.length)).toEqual(fileIds());
    expect(ids.slice(scenarioFiles.length)).toEqual([
      'sc-draft-well',
      'sc-village-always-win',
      'sc-exam-always-win',
      'sc-exam-always-lose',
      'sc-exam-always-timeout',
      'sc-exam-no-starter',
      'sc-village-no-propose',
      'sc-no-intro',
      'sc-mansion-mine',
    ]);
  });
});

describe('テスト専用の sc-village-always-win（村はずれの一歩の JSON から作る）', () => {
  it('sc-village-start との違いは、id・題名・概要・公開の状態（下書き）・試験官の HP・広場のテスト用カードだけ', () => {
    const expected = structuredClone(byId('sc-village-start'));
    expected.id = 'sc-village-always-win';
    expected.libraryStatus = 'draft';
    expected.title = '（テスト用）必ず合格する村はずれ';
    expected.summary = 'テスト専用シナリオ。';
    const exam = expected.deck.find((n) => n.id === 'vs-exam');
    if (!exam?.autoCombat) throw new Error('vs-exam がありません');
    exam.autoCombat.enemy.hp = 1;
    expected.deck
      .find((n) => n.id === 'vs-square')
      ?.cards.push({
        id: 'vw-lost',
        kind: 'choice',
        name: '（テスト用）迷い道',
        tags: [],
        nextNodeId: 'vw-nowhere',
        soloEffect: { raiseAbility: 'mind' },
      });
    expect(byId('sc-village-always-win')).toEqual(expected);
  });

  it('複製で元を汚さない（sc-village-start の試験官の HP は JSON の値のまま、広場にテスト用カードが無い）', () => {
    const start = byId('sc-village-start');
    const raw = rawFiles['../../../../scenarios/sc-village-start.json'] as typeof start;
    const rawHp = raw.deck.find((n) => n.id === 'vs-exam')?.autoCombat?.enemy.hp;
    expect(rawHp).toBeGreaterThan(1);
    expect(start.deck.find((n) => n.id === 'vs-exam')?.autoCombat?.enemy.hp).toBe(rawHp);
    expect(
      start.deck.find((n) => n.id === 'vs-square')?.cards.some((c) => c.id === 'vw-lost'),
    ).toBe(false);
  });
});

describe('fixtures に残る重複のずれ検知（統合するまで）', () => {
  it('灰色館の一夜の選択肢カードは、fixtures のセッションの手札と同じで、playScript のキーは JSON に実在する', () => {
    const door = byId('sc-gray-mansion').deck.find((n) => n.id === 'd-s2');
    const hand = sessions.find((s) => s.id === 'ss-mansion')?.hand ?? [];
    for (const id of ['ch-open', 'ch-inspect', 'ch-back']) {
      expect(door?.cards.find((c) => c.id === id)).toEqual(hand.find((c) => c.id === id));
    }
    const mansionCardIds = byId('sc-gray-mansion').deck.flatMap((n) => n.cards.map((c) => c.id));
    expect(Object.keys(playScript)).toEqual(['ch-open', 'ch-inspect', 'ch-back']);
    expect(Object.keys(playScript).filter((k) => !mansionCardIds.includes(k))).toEqual([]);
  });
});

describe('MSW 経由で取得する（local-flow の完成の条件2）', () => {
  it('GET /api/scenarios/:id は、scenarios/<id>.json の中身を返す（全ファイル）', async () => {
    for (const [path, raw] of Object.entries(rawFiles)) {
      const id = path
        .split('/')
        .pop()
        ?.replace(/\.json$/, '');
      expect(await api.get<Scenario>(`/scenarios/${id}`)).toEqual(raw);
    }
  });

  it('公開済みの一覧は JSON の公開済みのもの（元からある4本を含む）だけで、下書きの涸れ井戸・テスト専用は出ない', async () => {
    const list = await api.get<Scenario[]>('/scenarios');
    const ids = list.map((s) => s.id);
    expect(ids).toEqual(
      scenarioFiles.filter((s) => s.libraryStatus === 'published').map((s) => s.id),
    );
    expect(ids).toEqual(expect.arrayContaining(ORIGINAL_FILES));
    expect(ids).not.toContain('sc-draft-well');
  });

  it('自分のシナリオの一覧には、JSON の自分のもの（ガレオン）と fixtures の下書き（涸れ井戸・テスト専用の自分の灰色館）が出る', async () => {
    const list = await api.get<Scenario[]>('/scenarios?mine=1');
    const ids = list.map((s) => s.id);
    expect(ids).toEqual([
      ...scenarioFiles.filter((s) => s.authorId === 'u-me').map((s) => s.id),
      'sc-draft-well',
      'sc-mansion-mine',
    ]);
    expect(ids).toContain('sc-galleon');
  });
});
