// シーン編集の注意とつながり（docs/plans/2026-10-17-シナリオ製作の導線.md D10・G5、T11・T12）。
// 自分の下書き sc-mansion-mine のデッキを、次の形に差し替えて確かめる。
//   入口（導入）→ A → 終（結末のノード）。B はどこからも指されず（情報カードが指すだけ）、選択肢も無い。
//   従者（プール用の npc）は B と 終 の間に置く。終2 はどこからも指されない結末のノード。

import type { CardDef } from '@cartagraph/domain/card/model';
import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { renderAt } from './renderAt';

const get = async (id: string) =>
  (await api.get<ScenarioDraftView>(`/scenarios/${id}/draft`)).draft;
const choice = (id: string, name: string, nextNodeId?: string): CardDef => ({
  id,
  kind: 'choice',
  name,
  tags: [],
  ...(nextNodeId ? { nextNodeId } : {}),
});
const url = (nodeId: string) => `/creator/scenarios/sc-mansion-mine/scenes/${nodeId}`;

async function setupDeck() {
  const s: Scenario = await get('sc-mansion-mine');
  const endingId = s.endings[0]?.id as string;
  const deck: DeckNode[] = [
    { id: 'n-i', kind: 'intro', name: '入口', cards: [choice('c1', '進む', 'n-a')] },
    {
      id: 'n-a',
      kind: 'scene',
      name: 'A',
      cards: [
        choice('c2', '終わる', 'n-e'),
        choice('c3', 'もう一度終わる', 'n-e'),
        { id: 'c4', kind: 'info', name: '手がかり', tags: [], nextNodeId: 'n-b' },
      ],
    },
    { id: 'n-b', kind: 'scene', name: 'B', cards: [] },
    {
      id: 'n-npc',
      kind: 'npc',
      name: '従者',
      cards: [{ id: 'c5', kind: 'npc', name: '従者', tags: [] }],
    },
    { id: 'n-e', kind: 'ending', name: '終', cards: [], endingId },
    { id: 'n-e2', kind: 'ending', name: '終2', cards: [], endingId },
  ];
  await api.patch('/scenarios/sc-mansion-mine/draft', { deck, summary: '' });
}

/** つながりの項目（見出しの語）に対応する値の要素 */
const linkItem = (label: string) => {
  const section = screen
    .getByRole('heading', { name: 'つながり' })
    .closest('section') as HTMLElement;
  return within(section).getByText(label).nextElementSibling as HTMLElement;
};
const warnings = () => screen.queryByRole('region', { name: 'このシーンの注意' });

describe('シーン編集の注意（T11）', () => {
  it('行き止まりで、どこからも指されないシーンに2つの注意が出る。概要が未記入は出ない', async () => {
    await setupDeck();
    renderAt(url('n-b'));
    await screen.findByRole('heading', { level: 1, name: 'B' });
    const w = warnings() as HTMLElement;
    expect(w).toHaveTextContent('ここで先へ進めません');
    expect(w).toHaveTextContent('導入から届きません');
    expect(w).not.toHaveTextContent('概要');
  });

  it('選択肢の移り先を付けると（保存前でも）行き止まりの注意が消え、届かない注意は残る', async () => {
    const user = userEvent.setup();
    await setupDeck();
    renderAt(url('n-b'));
    await screen.findByRole('heading', { level: 1, name: 'B' });
    await user.click(screen.getByRole('button', { name: '＋カードを追加' }));
    await user.type(screen.getByLabelText('新しいカードの名前'), '出る');
    await user.selectOptions(screen.getByLabelText('種別'), 'choice');
    await user.click(screen.getByRole('button', { name: '追加' }));
    await user.selectOptions(screen.getByLabelText('移り先'), 'n-e');
    const w = warnings() as HTMLElement;
    expect(w).not.toHaveTextContent('ここで先へ進めません');
    expect(w).toHaveTextContent('導入から届きません');
  });

  it('導入と、導入から届く先へ進めるシーンには注意が出ない', async () => {
    await setupDeck();
    renderAt(url('n-i'));
    await screen.findByRole('heading', { level: 1, name: '入口' });
    expect(warnings()).not.toBeInTheDocument();
  });

  it('A も注意が出ない（情報カードの移り先では届かせたことにならないので B だけが届かない）', async () => {
    await setupDeck();
    renderAt(url('n-a'));
    await screen.findByRole('heading', { level: 1, name: 'A' });
    expect(warnings()).not.toBeInTheDocument();
  });

  it('結末のノードには、届かないときだけ「導入から届きません」が出る（行き止まりは出ない）', async () => {
    await setupDeck();
    renderAt(url('n-e2'));
    await screen.findByRole('heading', { name: '結末のノードの情報' });
    const w = warnings() as HTMLElement;
    expect(w).toHaveTextContent('導入から届きません');
    expect(w).not.toHaveTextContent('先へ進めません');
  });

  it('届く結末のノードには注意が出ない', async () => {
    await setupDeck();
    renderAt(url('n-e'));
    await screen.findByRole('heading', { name: '結末のノードの情報' });
    expect(warnings()).not.toBeInTheDocument();
  });

  it('カードの配置が補足より前にあり、補足は閉じている。中に未決の仮ルールの表示がある', async () => {
    await setupDeck();
    renderAt(url('n-a'));
    await screen.findByRole('heading', { level: 1, name: 'A' });
    const cards = screen.getByRole('heading', { name: '配置されているカード' });
    const supplement = screen.getByRole('heading', { name: '補足' });
    expect(
      cards.compareDocumentPosition(supplement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const details = supplement.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText(/未決の仮ルール/)).toBeInTheDocument();
    expect(within(details).getByLabelText('目的（仮）')).toBeInTheDocument();
  });

  it('読み取り専用（他人のシナリオ）では、補足は開いていて、注意は出ない', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion/scenes/d-s2');
    await screen.findByRole('heading', { level: 1, name: '3-2 奥の扉' });
    const details = screen
      .getByRole('heading', { name: '補足' })
      .closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(warnings()).not.toBeInTheDocument();
  });
});

describe('シーン編集のつながり（T12）', () => {
  it('A：移り先は同じ結末のノードを指す選択肢が2枚でも1つ。ここへ来るシーンは入口。情報カードの移り先は数えない', async () => {
    await setupDeck();
    renderAt(url('n-a'));
    await screen.findByRole('heading', { level: 1, name: 'A' });
    expect(within(linkItem('選択肢の移り先')).getAllByRole('link')).toHaveLength(1);
    expect(
      within(linkItem('選択肢の移り先')).getByRole('link', { name: '終' }),
    ).toBeInTheDocument();
    expect(
      within(linkItem('ここへ来るシーン')).getByRole('link', { name: '入口' }),
    ).toBeInTheDocument();
    expect(
      within(linkItem('デッキの並びの前')).getByRole('link', { name: '入口' }),
    ).toBeInTheDocument();
    expect(
      within(linkItem('デッキの並びの次')).getByRole('link', { name: 'B' }),
    ).toBeInTheDocument();
  });

  it('リンクで移ると、移り先の名前とカードの並びになる', async () => {
    const user = userEvent.setup();
    await setupDeck();
    renderAt(url('n-a'));
    await screen.findByRole('heading', { level: 1, name: 'A' });
    await user.click(within(linkItem('デッキの並びの次')).getByRole('link', { name: 'B' }));
    await screen.findByRole('heading', { level: 1, name: 'B' });
    expect(screen.getByLabelText('シーン名')).toHaveValue('B');
    expect(screen.getByText('まだカードがありません')).toBeInTheDocument();
  });

  it('B：移り先もここへ来るシーンも「なし」。次はプール用のノード（従者）を飛ばして結末のノード', async () => {
    await setupDeck();
    renderAt(url('n-b'));
    await screen.findByRole('heading', { level: 1, name: 'B' });
    expect(linkItem('選択肢の移り先')).toHaveTextContent('なし');
    expect(linkItem('ここへ来るシーン')).toHaveTextContent('なし');
    expect(
      within(linkItem('デッキの並びの前')).getByRole('link', { name: 'A' }),
    ).toBeInTheDocument();
    expect(
      within(linkItem('デッキの並びの次')).getByRole('link', { name: '終' }),
    ).toBeInTheDocument();
  });

  it('先頭のノードは前が「なし」', async () => {
    await setupDeck();
    renderAt(url('n-i'));
    await screen.findByRole('heading', { level: 1, name: '入口' });
    expect(linkItem('デッキの並びの前')).toHaveTextContent('なし');
    expect(within(linkItem('選択肢の移り先')).getByRole('link', { name: 'A' })).toBeInTheDocument();
  });

  it('最後のノード（結末のノード）は次が「なし」で、移り先も「なし」。前は終', async () => {
    await setupDeck();
    renderAt(url('n-e2'));
    await screen.findByRole('heading', { name: '結末のノードの情報' });
    expect(linkItem('デッキの並びの次')).toHaveTextContent('なし');
    expect(linkItem('選択肢の移り先')).toHaveTextContent('なし');
    expect(
      within(linkItem('デッキの並びの前')).getByRole('link', { name: '終' }),
    ).toBeInTheDocument();
  });

  it('保存前に移り先を変えると、選択肢の移り先がすぐ変わる', async () => {
    const user = userEvent.setup();
    await setupDeck();
    renderAt(url('n-i'));
    await screen.findByRole('heading', { level: 1, name: '入口' });
    await user.selectOptions(screen.getByLabelText('移り先'), 'n-b');
    expect(within(linkItem('選択肢の移り先')).getByRole('link', { name: 'B' })).toBeInTheDocument();
    expect(
      within(linkItem('選択肢の移り先')).queryByRole('link', { name: 'A' }),
    ).not.toBeInTheDocument();
  });

  it('読み取り専用でも出て、辿れる', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion/scenes/d-s2');
    await screen.findByRole('heading', { level: 1, name: '3-2 奥の扉' });
    // 画面は無効の fieldset の中にある。user-event はその中のリンクを押せないと見なすが、実ブラウザでは押せる
    fireEvent.click(
      within(linkItem('デッキの並びの次')).getByRole('link', { name: '3-3 隠し書庫' }),
    );
    await screen.findByRole('heading', { level: 1, name: '3-3 隠し書庫' });
  });
});
