// シナリオ製作者の編集：選択肢の移り先・導入と結末の編集・結末の追加と削除
// （docs/plans/2026-10-07-選択肢の移り先と結末の編集.md「5. 新規テストケース（画面）」）。

import type { CardDef } from '@cartagraph/domain/card/model';
import { safeParseScenarioFile, toScenarioFile } from '@cartagraph/domain/scenario/file';
import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import { findScenarioRefErrors } from '@cartagraph/domain/scenario/refs';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/shared/api/api';
import { setScenarioFileStore } from '../mocks/handlers';
import { DEAD_END, recruitCard, recruitPanel } from './gmlessHelpers';
import { renderAt } from './renderAt';

const get = (id: string) => api.get<Scenario>(`/scenarios/${id}`);
const nodeOf = (s: Scenario, id: string) => s.deck.find((n) => n.id === id) as DeckNode;
const button = (name: string | RegExp) => screen.getByRole('button', { name });

/** シーン編集の、カード名の行 */
const cardRow = async (name: string) =>
  (await screen.findByText(name)).closest('[data-card-row]') as HTMLElement;
/** シナリオ編集のデッキの構造の、ノード名の行（種別のラベル「導入」「結末」と取り違えないよう、名前の欄で探す） */
const deckRow = async (name: string) => {
  let row: HTMLElement | undefined;
  await waitFor(() => {
    row = [...document.querySelectorAll<HTMLElement>('[data-kind]')].find(
      (r) => r.children[1]?.textContent === name,
    );
    expect(row).toBeDefined();
  });
  return row as HTMLElement;
};
const optionLabels = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => o.textContent);

async function addCard(user: ReturnType<typeof userEvent.setup>, name: string, kind = 'choice') {
  await user.click(button('＋カードを追加'));
  await user.type(screen.getByLabelText('新しいカードの名前'), name);
  await user.selectOptions(screen.getByLabelText('種別'), kind);
  await user.click(button('追加'));
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(button('保存'));
  await waitFor(() => expect(button('保存')).toBeDisabled());
}

describe('シーン編集：選択肢の移り先', () => {
  it('選べるのは「移り先なし」と別のシーン・結末だけ（導入・プール用・自分自身は無い）。並び順と前置き', async () => {
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    const row = await cardRow('開ける');
    expect(optionLabels(within(row).getByLabelText('移り先'))).toEqual([
      '移り先なし',
      'シーン：3-1 地下回廊',
      'シーン：3-3 隠し書庫',
      '結末：結末',
    ]);
  });

  it('選んで保存すると nextNodeId が変わり、「移り先なし」で保存するとキーごと消えて公開できる', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await user.selectOptions(within(await cardRow('開ける')).getByLabelText('移り先'), 'd-s3');
    await save(user);
    const card = () =>
      get('sc-mansion-mine').then((s) => nodeOf(s, 'd-s2').cards.find((c) => c.id === 'ch-open'));
    expect((await card())?.nextNodeId).toBe('d-s3');

    await user.selectOptions(within(await cardRow('開ける')).getByLabelText('移り先'), '');
    await save(user);
    expect(await card()).not.toHaveProperty('nextNodeId');
    // 空文字が残っていれば参照の検査に落ちる
    expect(findScenarioRefErrors(await get('sc-mansion-mine'))).toEqual([]);
  });

  it('追加したばかりの選択肢の初期値は「移り先なし」。選択肢でないカードには「移り先」が出ない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await cardRow('開ける');
    await addCard(user, '扉を叩く');
    expect(within(await cardRow('扉を叩く')).getByLabelText('移り先')).toHaveValue('');
    expect(
      within(await cardRow('何かが書かれた紙')).queryByLabelText('移り先'),
    ).not.toBeInTheDocument();
  });

  it('デッキに無い移り先は「（見つからない：〈id〉）」と出て、選び直せる。ほかのカードには出ない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-village-always-win/scenes/vs-square');
    const select = within(await cardRow('（テスト用）迷い道')).getByLabelText('移り先');
    expect(select).toHaveValue('vw-nowhere');
    expect(optionLabels(select)).toContain('（見つからない：vw-nowhere）');
    expect(
      within(await cardRow('お店へ行く')).queryByRole('option', { name: /見つからない/ }),
    ).not.toBeInTheDocument();
    await user.selectOptions(select, 'vs-shop');
    expect(select).toHaveValue('vs-shop');
  });

  it('候補外の移り先（導入を指す）は「（候補外：〈名前〉）」と出て、選び直さずに保存しても残る', async () => {
    const user = userEvent.setup();
    const s = await get('sc-mansion-mine');
    await api.patch(`/scenarios/sc-mansion-mine`, {
      deck: s.deck.map((n) =>
        n.id === 'd-s2'
          ? {
              ...n,
              cards: n.cards.map((c) => (c.id === 'ch-back' ? { ...c, nextNodeId: 'd-intro' } : c)),
            }
          : n,
      ),
    });
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    const select = within(await cardRow('戻る')).getByLabelText('移り先');
    expect(select).toHaveValue('d-intro');
    expect(optionLabels(select)).toContain('（候補外：灰色館へ到着）');
    await user.type(screen.getByLabelText('目的（仮）'), 'x');
    await save(user);
    const after = nodeOf(await get('sc-mansion-mine'), 'd-s2').cards.find(
      (c) => c.id === 'ch-back',
    );
    expect(after?.nextNodeId).toBe('d-intro');
  });

  it('配る条件・成長の効果を持つ選択肢の移り先だけを変えて保存しても、それらは残る', async () => {
    const user = userEvent.setup();
    const rich: CardDef = {
      id: 'ch-rich',
      kind: 'choice',
      name: '鍵を使う',
      tags: [],
      dealWhen: { hasTags: ['鍵'] },
      soloEffect: { raiseAbility: 'mind' },
    };
    const s = await get('sc-mansion-mine');
    await api.patch(`/scenarios/sc-mansion-mine`, {
      deck: s.deck.map((n) => (n.id === 'd-s2' ? { ...n, cards: [...n.cards, rich] } : n)),
    });
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await user.selectOptions(within(await cardRow('鍵を使う')).getByLabelText('移り先'), 'd-s3');
    await save(user);
    const after = nodeOf(await get('sc-mansion-mine'), 'd-s2').cards.find(
      (c) => c.id === 'ch-rich',
    );
    expect(after).toEqual({ ...rich, nextNodeId: 'd-s3' });
  });
});

describe('シーン編集：導入と結末', () => {
  it('導入を開ける。選択肢と移り先を置いて保存でき、目的・終了条件（仮）は出ない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-intro');
    await screen.findByRole('heading', { level: 1, name: '灰色館へ到着' });
    expect(screen.getByRole('heading', { name: '導入の情報' })).toBeInTheDocument();
    expect(screen.getByLabelText('導入の名前')).toHaveValue('灰色館へ到着');
    expect(screen.queryByLabelText('目的（仮）')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('終了条件（仮）')).not.toBeInTheDocument();
    expect(screen.queryByText(/未決の仮ルール/)).not.toBeInTheDocument();
    await addCard(user, '館へ入る');
    await user.selectOptions(within(await cardRow('館へ入る')).getByLabelText('移り先'), 'd-s1');
    await save(user);
    const card = nodeOf(await get('sc-mansion-mine'), 'd-intro').cards.find(
      (c) => c.name === '館へ入る',
    );
    expect(card?.nextNodeId).toBe('d-s1');
  });

  it('結末を開くと名前と「指す結末」だけが出る。指す結末を選んで保存でき、「指さない」でキーごと消える', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-end');
    await screen.findByRole('heading', { name: '結末のノードの情報' });
    expect(screen.getByText(/GM 不在のソロの仮ルール/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '＋カードを追加' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ロケーション' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('目的（仮）')).not.toBeInTheDocument();
    const select = screen.getByLabelText('指す結末');
    expect(optionLabels(select)).toEqual([
      '指さない',
      '扉を壊して真相にたどり着いた結末',
      '扉を開けず引き返した結末',
      '老従者と和解した結末',
    ]);
    await user.clear(screen.getByLabelText('結末のノードの名前'));
    await user.type(screen.getByLabelText('結末のノードの名前'), '館を去る');
    await user.selectOptions(select, 'e2');
    await save(user);
    const end = () => get('sc-mansion-mine').then((s) => nodeOf(s, 'd-end'));
    expect(await end()).toMatchObject({ name: '館を去る', endingId: 'e2' });

    await user.selectOptions(screen.getByLabelText('指す結末'), '');
    await save(user);
    expect(await end()).not.toHaveProperty('endingId');
  });

  it('既にカードがある結末のノードを名前だけ変えて保存しても、カードは消えない', async () => {
    const user = userEvent.setup();
    const s = await get('sc-mansion-mine');
    const epilogue: CardDef = { id: 'c-epilogue', kind: 'info', name: '後日談', tags: [] };
    await api.patch(`/scenarios/sc-mansion-mine`, {
      deck: s.deck.map((n) => (n.id === 'd-end' ? { ...n, cards: [epilogue] } : n)),
    });
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-end');
    await user.type(await screen.findByLabelText('結末のノードの名前'), '（改）');
    await save(user);
    expect(nodeOf(await get('sc-mansion-mine'), 'd-end').cards).toEqual([epilogue]);
  });

  it('結末に無い結末を指す結末のノードは「（見つからない：〈id〉）」と出て、選び直さずに保存しても残る', async () => {
    const user = userEvent.setup();
    const s = await get('sc-mansion-mine');
    await api.patch(`/scenarios/sc-mansion-mine`, {
      deck: s.deck.map((n) => (n.id === 'd-end' ? { ...n, endingId: 'e-gone' } : n)),
    });
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-end');
    const select = await screen.findByLabelText('指す結末');
    expect(select).toHaveValue('e-gone');
    expect(optionLabels(select)).toContain('（見つからない：e-gone）');
    await user.type(screen.getByLabelText('結末のノードの名前'), '（改）');
    await save(user);
    expect(nodeOf(await get('sc-mansion-mine'), 'd-end').endingId).toBe('e-gone');
  });

  it('自分自身を指す選択肢（JSON で書いたもの）は「（候補外：〈名前〉）」と出る', async () => {
    const s = await get('sc-mansion-mine');
    await api.patch(`/scenarios/sc-mansion-mine`, {
      deck: s.deck.map((n) =>
        n.id === 'd-s2'
          ? {
              ...n,
              cards: n.cards.map((c) => (c.id === 'ch-open' ? { ...c, nextNodeId: 'd-s2' } : c)),
            }
          : n,
      ),
    });
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    const select = within(await cardRow('開ける')).getByLabelText('移り先');
    expect(select).toHaveValue('d-s2');
    expect(optionLabels(select)).toContain('（候補外：3-2 奥の扉）');
  });
});

describe('シナリオ編集：削除と結末', () => {
  const open = async (title = '編集のテスト') => {
    const sc = await api.post<Scenario>('/scenarios', { title });
    const router = renderAt(`/creator/scenarios/${sc.id}`);
    await screen.findByRole('heading', { level: 1, name: title });
    return { sc, router };
  };

  it('導入・結末にも「編集」のリンクがあり、プール用には無い。導入・結末に「削除」「濃密に」は無い', async () => {
    renderAt('/creator/scenarios/sc-mansion-mine');
    for (const name of ['灰色館へ到着', '結末']) {
      const row = await deckRow(name);
      expect(within(row).getByRole('link', { name: '編集' })).toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: /濃密に|軽量に/ })).not.toBeInTheDocument();
    }
    expect(
      within(await deckRow('館の老従者')).queryByRole('link', { name: '編集' }),
    ).not.toBeInTheDocument();
  });

  it('保存していないノードには「編集」が出ず、保存すると出る', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(button('シーンを追加'));
    await user.click(button('結末を追加'));
    for (const name of ['1 新しいシーン', '新しい結末']) {
      const row = await deckRow(name);
      expect(within(row).queryByRole('link', { name: '編集' })).not.toBeInTheDocument();
      expect(within(row).getByText('保存すると編集できる')).toBeInTheDocument();
    }
    await save(user);
    for (const name of ['1 新しいシーン', '新しい結末'])
      expect(within(await deckRow(name)).getByRole('link', { name: '編集' })).toBeInTheDocument();
  });

  it('移り先になっているシーンは削除できず理由が出る。指されていないシーンは消える', async () => {
    const user = userEvent.setup();
    const s = await get('sc-mansion-mine');
    await api.patch('/scenarios/sc-mansion-mine', {
      deck: s.deck.map((n) =>
        n.id === 'd-intro'
          ? {
              ...n,
              cards: [{ id: 'c-go', kind: 'choice', name: '地下へ', tags: [], nextNodeId: 'd-s1' }],
            }
          : n,
      ),
    });
    renderAt('/creator/scenarios/sc-mansion-mine');
    await user.click(within(await deckRow('3-1 地下回廊')).getByRole('button', { name: '削除' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '『地下へ』（灰色館へ到着）から指されているので削除できません',
    );
    expect(screen.getByText('3-1 地下回廊')).toBeInTheDocument();
    expect(button('保存')).toBeDisabled();

    await user.click(within(await deckRow('3-3 隠し書庫')).getByRole('button', { name: '削除' }));
    expect(screen.queryByText('3-3 隠し書庫')).not.toBeInTheDocument();
  });

  it('下書きの中で、指している側のシーンを先に消すと、指されていたシーンも消せる', async () => {
    const user = userEvent.setup();
    const s = await get('sc-mansion-mine');
    await api.patch('/scenarios/sc-mansion-mine', {
      deck: s.deck.map((n) =>
        n.id === 'd-s1'
          ? {
              ...n,
              cards: [{ id: 'c-go', kind: 'choice', name: '奥へ', tags: [], nextNodeId: 'd-s3' }],
            }
          : n,
      ),
    });
    renderAt('/creator/scenarios/sc-mansion-mine');
    await user.click(within(await deckRow('3-1 地下回廊')).getByRole('button', { name: '削除' }));
    await user.click(within(await deckRow('3-3 隠し書庫')).getByRole('button', { name: '削除' }));
    expect(screen.queryByText('3-3 隠し書庫')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('「結末を追加」を続けて押し、同じ時刻に「シーンを追加」しても id が重ならず、保存して公開できる', async () => {
    const user = userEvent.setup();
    const { sc } = await open();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      await user.click(button('結末を追加'));
      await user.click(button('結末を追加'));
      await user.click(button('シーンを追加'));
    } finally {
      now.mockRestore();
    }
    await save(user);
    const after = await get(sc.id);
    expect(after.endings).toHaveLength(3);
    expect(after.deck.filter((n) => n.kind === 'ending')).toHaveLength(3);
    expect(findScenarioRefErrors(after)).toEqual([]);
    await user.click(button('シナリオ集へ公開'));
    expect(await screen.findByText('シナリオ集に公開中')).toBeInTheDocument();
  });

  it('結末の「削除」で結末と結末のノードの両方が消え、保存しても参照の誤りが無い', async () => {
    const user = userEvent.setup();
    const { sc } = await open();
    await user.click(button('結末を追加'));
    const panel = screen.getByRole('heading', { name: '結末' }).closest('section') as HTMLElement;
    const rows = within(panel).getAllByLabelText('結末の名前');
    expect(rows).toHaveLength(2);
    const del = within(panel).getAllByRole('button', { name: '削除' });
    await user.click(del[0] as HTMLElement);
    expect(within(panel).getAllByLabelText('結末の名前')).toHaveLength(1);
    await save(user);
    const after = await get(sc.id);
    expect(after.endings).toHaveLength(1);
    expect(after.deck.filter((n) => n.kind === 'ending')).toHaveLength(1);
    expect(findScenarioRefErrors(after)).toEqual([]);
  });

  it('移り先になっている結末のノードの結末は消せず、理由が出る', async () => {
    const user = userEvent.setup();
    const sc = await api.post<Scenario>('/scenarios', { title: '結末を指す' });
    const endNode = sc.deck.find((n) => n.kind === 'ending') as DeckNode;
    await api.patch(`/scenarios/${sc.id}`, {
      deck: sc.deck.map((n) =>
        n.kind === 'intro'
          ? {
              ...n,
              cards: [
                { id: 'c-end', kind: 'choice', name: '終える', tags: [], nextNodeId: endNode.id },
              ],
            }
          : n,
      ),
    });
    renderAt(`/creator/scenarios/${sc.id}`);
    const panel = (await screen.findByRole('heading', { name: '結末' })).closest(
      'section',
    ) as HTMLElement;
    await user.click(within(panel).getByRole('button', { name: '削除' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '『終える』（導入）から指されているので削除できません',
    );
    expect(within(panel).getAllByLabelText('結末の名前')).toHaveLength(1);
  });

  it('結末の名前を変えて保存しても、結末のノードの名前は変わらない。結末タグの欄は「結末タグ」', async () => {
    const user = userEvent.setup();
    const { sc } = await open();
    const panel = screen.getByRole('heading', { name: '結末' }).closest('section') as HTMLElement;
    expect(within(panel).getByLabelText('結末タグ')).toHaveAttribute(
      'placeholder',
      '結末タグ（空なら単発）',
    );
    await user.type(within(panel).getByLabelText('結末の名前'), '（改）');
    await save(user);
    const after = await get(sc.id);
    expect(after.endings[0]?.name).toBe('結末（改）');
    expect(after.deck.find((n) => n.kind === 'ending')?.name).toBe('結末');
  });
});

describe('通し：画面だけで作る → 公開 → GM 不在で募集 → PL が結末まで（local-flow の完成の条件2）', () => {
  it('作ったシナリオを、GM 不在のセッションで結末まで遊び、結末タグを得る', async () => {
    const user = userEvent.setup();
    const written: Scenario[] = [];
    setScenarioFileStore({ write: async (s) => void written.push(structuredClone(s)) });
    const title = '村はずれの小道';

    // 製作者：作る
    const router = renderAt('/creator/scenarios');
    await user.type(await screen.findByPlaceholderText('シナリオのタイトル'), title);
    await user.click(button('下書きを作成'));
    await screen.findByRole('heading', { level: 1, name: title });
    const id = router.state.location.pathname.split('/').pop() as string;
    await user.click(button('シーンを追加'));
    await save(user);

    await user.click(within(await deckRow('導入')).getByRole('link', { name: '編集' }));
    await screen.findByRole('heading', { name: '導入の情報' });
    await addCard(user, '村へ');
    await user.selectOptions(
      within(await cardRow('村へ')).getByLabelText('移り先'),
      screen.getByRole('option', { name: 'シーン：1 新しいシーン' }),
    );
    await save(user);

    await router.navigate(`/creator/scenarios/${id}`);
    await user.click(within(await deckRow('1 新しいシーン')).getByRole('link', { name: '編集' }));
    await screen.findByRole('heading', { name: 'シーン情報' });
    await addCard(user, '帰る');
    await user.selectOptions(
      within(await cardRow('帰る')).getByLabelText('移り先'),
      screen.getByRole('option', { name: '結末：結末' }),
    );
    await save(user);

    await router.navigate(`/creator/scenarios/${id}`);
    await screen.findByRole('heading', { level: 1, name: title });
    await user.type(screen.getByLabelText('結末タグ'), '村を見た');
    await save(user);
    await user.click(button('シナリオ集へ公開'));
    await screen.findByText(`scenarios/${id}.json に保存しました`);

    // 書かれた JSON が、遊べる形になっている
    const file = written.at(-1) as Scenario;
    const intro = file.deck.find((n) => n.kind === 'intro') as DeckNode;
    const scene = file.deck.find((n) => n.kind === 'scene') as DeckNode;
    const ending = file.deck.find((n) => n.kind === 'ending') as DeckNode;
    expect(intro.cards.find((c) => c.name === '村へ')?.nextNodeId).toBe(scene.id);
    expect(scene.cards.find((c) => c.name === '帰る')?.nextNodeId).toBe(ending.id);
    expect(ending.endingId).toBe(file.endings[0]?.id);
    expect(file.endings[0]?.grantsTag).toBe('村を見た');
    expect(safeParseScenarioFile(`scenarios/${id}.json`, toScenarioFile(file)).ok).toBe(true);

    // GM：GM 不在・提案不可で募集する
    await router.navigate(`/gm/scenarios/${id}`);
    const p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    await user.selectOptions(within(p).getByLabelText('提案の扱い'), 'disabled');
    expect(within(p).queryByText(DEAD_END)).not.toBeInTheDocument();
    await user.click(within(p).getByRole('button', { name: /この構成で募集を出す/ }));
    await screen.findByRole('heading', { name: '自分の募集' });

    // PL：絞り込んで自分の PC で始め、結末まで
    await router.navigate('/pl/sessions');
    await screen.findByRole('heading', { name: '参加できるセッション' });
    await user.click(screen.getByLabelText('GM 不在の募集だけ'));
    const card = await recruitCard(title, 'ユウ');
    await user.selectOptions(within(card).getByLabelText('始める PC'), 'pc-jin');
    await user.click(within(card).getByRole('button', { name: 'この PC で始める' }));
    await user.click(await screen.findByRole('button', { name: /村へ/ }));
    // 移ると、手札は移り先のノードの選択肢で配り直される（play-and-field.md「次のシーンへ進む」）
    await screen.findByRole('button', { name: /帰る/ });
    expect(screen.queryByRole('button', { name: /村へ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /帰る/ }));
    expect(await screen.findByText('このセッションは終了しています。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '結末「結末」' })).toBeInTheDocument();
    expect(screen.getAllByText(/結末タグ『村を見た』を得た。/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('link', { name: 'キャラクターシート' }));
    expect(await screen.findByText('村を見た')).toBeInTheDocument();
  });
});
