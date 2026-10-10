// シナリオタイプ（docs/cartagraph/scenario-type.md）の、シードの整合・募集へのコピー・公開の検査・画面の表示
// （docs/plans/2026-10-10-冒険者だけにする.md C2-T6〜C2-T12）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { findScenarioTypeErrors } from '@cartagraph/domain/scenario/type';
import type { Recruitment } from '@cartagraph/domain/session/model';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ScenarioSaveResult } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { recruitments, scenarios } from '../mocks/fixtures';
import { setScenarioFileStore } from '../mocks/handlers';
import { scenarioFiles } from '../mocks/scenarioFiles';
import { renderAt } from './renderAt';

const ADVENTURE = { noCombat: false, noCheck: false };
const NO_COMBAT = { noCombat: true, noCheck: false };
const READING = { noCombat: true, noCheck: true };

const scenarioOf = (id: string) => {
  const s = scenarios.find((x) => x.id === id);
  if (!s) throw new Error(`${id} がありません`);
  return s;
};

/** 偽の保存先。渡されたシナリオを記録する */
function fakeStore() {
  const written: Scenario[] = [];
  setScenarioFileStore({ write: async (s) => void written.push(structuredClone(s)) });
  return written;
}

/** 自動戦闘のシーン（試験官は村はずれの一歩の JSON から借りる） */
function examNode(): Scenario['deck'][number] {
  const exam = scenarioOf('sc-village-start').deck.find((n) => n.autoCombat);
  if (!exam?.autoCombat) throw new Error('村はずれの一歩に自動戦闘のシーンがありません');
  return {
    id: 'exam',
    kind: 'scene',
    name: '試験',
    cards: [],
    autoCombat: structuredClone(exam.autoCombat),
  };
}

const create = (title: string) => api.post<Scenario>('/scenarios', { title });
const publish = (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/publish`);
const patch = (id: string, body: Partial<Scenario>) =>
  api.patch<ScenarioSaveResult>(`/scenarios/${id}`, body);
const get = (id: string) => api.get<Scenario>(`/scenarios/${id}`);

describe('シードのシナリオタイプ', () => {
  it('scenarios/*.json の4本は、決めたタイプを持つ', () => {
    const typeOf = (id: string) => scenarioFiles.find((s) => s.id === id)?.scenarioType;
    expect(typeOf('sc-galleon')).toEqual(ADVENTURE);
    expect(typeOf('sc-village-start')).toEqual(ADVENTURE);
    expect(typeOf('sc-gray-mansion')).toEqual(NO_COMBAT);
    expect(typeOf('sc-corridor-after')).toEqual(READING);
  });

  it('fixtures の全シナリオが、宣言と中身の検査を通る（fixtures にしか無いシナリオは読み込みの検査を通らないため）', () => {
    for (const s of scenarios) expect([s.id, findScenarioTypeErrors(s)]).toEqual([s.id, []]);
  });

  it('fixtures の募集は、元のシナリオと同じタイプを持つ', () => {
    for (const rc of recruitments)
      expect([rc.id, rc.scenarioType]).toEqual([rc.id, scenarioOf(rc.scenarioId).scenarioType]);
  });

  it('灰色館から募集を作ると、募集のタイプは灰色館と同じ（戦闘なし）', async () => {
    const rc = await api.post<Recruitment>('/scenarios/sc-gray-mansion/recruitments', {
      kind: 'normal',
      capacity: 2,
      excludedNodeIds: [],
    });
    expect(rc.scenarioType).toEqual(NO_COMBAT);
  });
});

describe('公開・公開中の保存でのシナリオタイプの検査', () => {
  it('戦闘なしで自動戦闘のシーンを持つ下書きは、保存できるが公開は 422 で、保存先に渡らず下書きのまま', async () => {
    const sc = await create('戦闘なしの公開テスト');
    await patch(sc.id, { scenarioType: NO_COMBAT, deck: [...sc.deck, examNode()] });
    const written = fakeStore();
    await expect(publish(sc.id)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('戦闘なし'),
    });
    expect(written).toEqual([]);
    expect((await get(sc.id)).libraryStatus).toBe('draft');
  });

  it('同じデッキでも冒険なら公開できる（反対側）', async () => {
    const sc = await create('冒険の公開テスト');
    await patch(sc.id, { deck: [...sc.deck, examNode()] });
    expect((await publish(sc.id)).scenario.libraryStatus).toBe('published');
  });

  it('公開中のガレオンを、空間モデルを持ったまま戦闘なしにする保存は 422 で、メモリも変わらない', async () => {
    const written = fakeStore();
    await expect(patch('sc-galleon', { scenarioType: NO_COMBAT })).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('空間モデル'),
    });
    expect(written).toEqual([]);
    expect((await get('sc-galleon')).scenarioType).toEqual(ADVENTURE);
  });

  it('公開中のガレオンでも、空間モデルを外して戦闘なしにする保存は通る（反対側）', async () => {
    const written = fakeStore();
    const res = await patch('sc-galleon', { scenarioType: NO_COMBAT, spaceModel: null });
    expect(res.scenario.scenarioType).toEqual(NO_COMBAT);
    expect(written.map((s) => s.scenarioType)).toEqual([NO_COMBAT]);
  });
});

describe('シナリオタイプの表示', () => {
  const typeChip = async () => (await screen.findByTestId('scenario-type')).textContent;

  it.each([
    ['sc-gray-mansion', '戦闘なし'],
    ['sc-corridor-after', '読み物'],
    ['sc-galleon', '冒険'],
    ['sc-village-start', '冒険'],
  ])('GM のシナリオ詳細：%s のタイプは「%s」', async (id, label) => {
    renderAt(`/gm/scenarios/${id}`);
    expect(await typeChip()).toBe(label);
    expect(screen.queryByText('なし（旅人向け）')).not.toBeInTheDocument();
  });

  it('GM のシナリオ詳細：空間モデルの無い村はずれの一歩は「空間なし」と出て、「戦闘なし」はどこにも出ない', async () => {
    renderAt('/gm/scenarios/sc-village-start');
    expect(await screen.findByText('空間なし')).toBeInTheDocument();
    expect(screen.queryByText(/戦闘なし/)).not.toBeInTheDocument();
  });

  it('GM のシナリオ一覧：各シナリオにタイプのチップが出る', async () => {
    renderAt('/gm/scenarios');
    const panel = (await screen.findByRole('link', { name: '鉄鎖のガレオン船' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(panel).getByTestId('scenario-type')).toHaveTextContent('冒険');
  });

  it('セッション選択：灰色館の募集は「戦闘なし」、ガレオンの募集は「冒険」', async () => {
    renderAt('/pl/sessions');
    const card = async (title: string) =>
      (await screen.findAllByText(title))[0].closest('article') as HTMLElement;
    expect(within(await card('灰色館の一夜')).getByTestId('scenario-type')).toHaveTextContent(
      '戦闘なし',
    );
    expect(within(await card('鉄鎖のガレオン船')).getByTestId('scenario-type')).toHaveTextContent(
      '冒険',
    );
  });

  it('シナリオ編集：「戦闘なし」を付けると空間モデルを外して選べなくし、保存すると戦闘なしで空間なしになる', async () => {
    const user = userEvent.setup();
    fakeStore();
    renderAt('/creator/scenarios/sc-galleon');
    await screen.findByRole('heading', { level: 1, name: '鉄鎖のガレオン船' });
    expect(screen.getByTestId('scenario-type')).toHaveTextContent('冒険');
    const space = screen.getByLabelText(/空間モデル/) as HTMLSelectElement;
    expect(space).toHaveValue('2d');
    await user.click(screen.getByLabelText('戦闘なし'));
    expect(space).toHaveValue('');
    expect(space).toBeDisabled();
    expect(screen.getByTestId('scenario-type')).toHaveTextContent('戦闘なし');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(async () => {
      const saved = await get('sc-galleon');
      expect(saved.scenarioType).toEqual(NO_COMBAT);
      expect(saved.spaceModel).toBeNull();
    });
  });
});
