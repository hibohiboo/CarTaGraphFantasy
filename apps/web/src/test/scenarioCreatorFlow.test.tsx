// シナリオ製作の導線：シナリオ編集の組み替え・次にすることの案内・公開の前の確かめ・読み取り専用・一覧
// （docs/plans/2026-10-17-シナリオ製作の導線.md T6〜T10）。

import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { scenarios } from '../mocks/fixtures';
import { renderAt } from './renderAt';

const create = async (title: string) =>
  (await api.post<ScenarioDraftView>('/scenarios', { title })).draft;
const getDraft = async (id: string) =>
  (await api.get<ScenarioDraftView>(`/scenarios/${id}/draft`)).draft;
const patch = (id: string, body: Partial<Scenario>) =>
  api.patch<ScenarioDraftView>(`/scenarios/${id}/draft`, body);
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const guide = () => screen.getByRole('region', { name: '次にすること' });
const check = () => screen.getByRole('region', { name: '公開の前の確かめ' });
const stepItem = (label: string) => within(guide()).getByText(label).closest('li') as HTMLElement;
const foldHeading = () => screen.getByRole('heading', { level: 2, name: '公開の前に決めること' });

/** 導入 →（選択肢）→ 結末のノード、概要あり：確かめに問題が出ない形 */
async function makeComplete(id: string) {
  const d = await getDraft(id);
  const intro = d.deck.find((n) => n.kind === 'intro') as DeckNode;
  const ending = d.deck.find((n) => n.kind === 'ending') as DeckNode;
  await patch(id, {
    summary: '紹介文',
    deck: d.deck.map((n) =>
      n.id === intro.id
        ? {
            ...n,
            cards: [{ id: 'c-go', kind: 'choice', name: '進む', tags: [], nextNodeId: ending.id }],
          }
        : n,
    ),
  });
}

describe('シナリオ編集の並び（T6）', () => {
  it('タイトル・デッキ・結末が見え、「公開の前に決めること」は閉じて1行の要約を出す。開いて書いて保存しても開いたまま', async () => {
    const user = userEvent.setup();
    const d = await create('新しい話');
    renderAt(`/creator/scenarios/${d.id}`);
    expect(await screen.findByLabelText('タイトル')).toHaveValue('新しい話');
    expect(screen.getByRole('heading', { name: 'シナリオデッキの構造' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '結末', level: 2 })).toBeInTheDocument();

    expect(screen.getByLabelText('概要')).not.toBeVisible();
    expect(screen.getByText('冒険・2〜4人・推奨CP 3・空間なし・概要が未記入')).toBeInTheDocument();

    await user.click(foldHeading());
    await waitFor(() => expect(screen.getByLabelText('概要')).toBeVisible());
    await user.type(screen.getByLabelText('概要'), '嵐の夜');
    expect(screen.getByText('冒険・2〜4人・推奨CP 3・空間なし')).toBeInTheDocument();

    await user.click(button('保存'));
    await waitFor(async () => expect((await getDraft(d.id)).summary).toBe('嵐の夜'));
    await waitFor(() => expect(button('保存')).toBeDisabled());
    expect(screen.getByLabelText('概要')).toBeVisible();
    expect(screen.getByLabelText('概要')).toHaveValue('嵐の夜');
  });
});

describe('次にすることの案内（T7）', () => {
  it('作った直後は「シーンを作る」が次。保存しないままシーンを追加すると済みになり、次が移る', async () => {
    const user = userEvent.setup();
    const d = await create('案内');
    renderAt(`/creator/scenarios/${d.id}`);
    await screen.findByRole('region', { name: '次にすること' });
    expect(stepItem('シーンを作る')).toHaveAttribute('aria-current', 'step');
    expect(within(stepItem('タイトルを付ける')).getByText('済み')).toBeInTheDocument();

    await user.click(button('シーンを追加'));
    await waitFor(() =>
      expect(within(stepItem('シーンを作る')).getByText('済み')).toBeInTheDocument(),
    );
    expect(stepItem('選択肢で結末までつなぐ')).toHaveAttribute('aria-current', 'step');
    expect(button('保存')).toBeEnabled();
  });

  it('④の「開く」で「公開の前に決めること」が開く', async () => {
    const user = userEvent.setup();
    const d = await create('開く');
    renderAt(`/creator/scenarios/${d.id}`);
    await screen.findByRole('region', { name: '次にすること' });
    expect(screen.getByLabelText('概要')).not.toBeVisible();
    await user.click(within(guide()).getByRole('button', { name: '開く' }));
    await waitFor(() => expect(screen.getByLabelText('概要')).toBeVisible());
  });

  it('公開すると案内が消える', async () => {
    const user = userEvent.setup();
    const d = await create('公開する');
    renderAt(`/creator/scenarios/${d.id}`);
    await screen.findByRole('region', { name: '次にすること' });
    await user.click(button('シナリオ集へ公開'));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '次にすること' })).not.toBeInTheDocument(),
    );
  });

  it('公開版のある自分のシナリオ・シナリオ集から外した後には出ない。コピーした下書きには出る', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon');
    await screen.findByLabelText('タイトル');
    expect(screen.queryByRole('region', { name: '次にすること' })).not.toBeInTheDocument();
    await user.click(button('非公開にする'));
    await screen.findByRole('button', { name: 'シナリオ集へ公開' });
    expect(screen.queryByRole('region', { name: '次にすること' })).not.toBeInTheDocument();
  });

  it('コピーした下書き（公開版なし）には出る', async () => {
    const copied = (await api.post<ScenarioDraftView>('/scenarios/sc-galleon/copy')).draft.id;
    renderAt(`/creator/scenarios/${copied}`);
    expect(await screen.findByRole('region', { name: '次にすること' })).toBeInTheDocument();
  });
});

describe('公開の前の確かめ（T8）', () => {
  it('作った直後：行き止まりの導入・届かない結末のノード・概要の未記入が注意に出るが、公開は押せて公開できる', async () => {
    const user = userEvent.setup();
    const d = await create('確かめ');
    renderAt(`/creator/scenarios/${d.id}`);
    await screen.findByRole('region', { name: '公開の前の確かめ' });
    const items = within(check())
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      '導入：GM 不在で遊ぶと、ここで先へ進めません',
      '結末：GM 不在で遊ぶと、導入から届きません',
      '概要が未記入です（GM がシナリオを選ぶときの紹介文になります）',
    ]);
    expect(within(check()).getByText('注意（公開はできます）')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(button('シナリオ集へ公開')).toBeEnabled();
    await user.click(button('シナリオ集へ公開'));
    await waitFor(() => expect(screen.getByText('シナリオ集に公開中')).toBeInTheDocument());
  });

  it('結末までつないで概要を書くと「問題はありません」', async () => {
    const d = await create('問題なし');
    await makeComplete(d.id);
    renderAt(`/creator/scenarios/${d.id}`);
    expect(await screen.findByText('公開の前の確かめ：問題はありません')).toBeInTheDocument();
  });

  it('注意のノードの名前からシーン編集へ移れる。保存前に足したシーンは「保存すると編集できる」', async () => {
    const user = userEvent.setup();
    const d = await create('リンク');
    renderAt(`/creator/scenarios/${d.id}`);
    await screen.findByRole('region', { name: '公開の前の確かめ' });
    await user.click(button('シーンを追加'));
    await waitFor(() =>
      // 保存前のシーンは、行き止まりと届かないの2件に出る
      expect(within(check()).getAllByText('（保存すると編集できる）')).toHaveLength(2),
    );
    // 保存前に足したシーンがあるので、移る前に確かめが出る（認めて移る）
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(within(check()).getByRole('link', { name: '導入' }));
    expect(await screen.findByRole('heading', { level: 1, name: '導入' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('プール用のノードは注意に出ない', async () => {
    renderAt('/creator/scenarios/sc-mansion-mine');
    await screen.findByRole('region', { name: '公開の前の確かめ' });
    expect(within(check()).queryByText(/館の老従者/)).not.toBeInTheDocument();
  });

  it('止める誤り：保存前でも理由が出て公開が押せなくなり、外すと消える。理由が出ていても保存は押せる', async () => {
    const user = userEvent.setup();
    const d = await create('誤り');
    const exam = scenarios.find((s) => s.id === 'sc-village-start')?.deck.find((n) => n.autoCombat);
    const deck = (await getDraft(d.id)).deck;
    await patch(d.id, {
      deck: [
        ...deck,
        { id: 'exam', kind: 'scene', name: '試験', cards: [], autoCombat: exam?.autoCombat },
      ],
    });
    renderAt(`/creator/scenarios/${d.id}`);
    await screen.findByRole('region', { name: '公開の前の確かめ' });
    expect(within(check()).queryByText('公開できない理由')).not.toBeInTheDocument();
    expect(button('シナリオ集へ公開')).toBeEnabled();

    await user.click(foldHeading());
    await user.click(screen.getByRole('checkbox', { name: '戦闘なし' }));
    expect(await within(check()).findByText('公開できない理由')).toBeInTheDocument();
    expect(button('シナリオ集へ公開')).toBeDisabled();
    expect(button('保存')).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: '戦闘なし' }));
    await waitFor(() =>
      expect(within(check()).queryByText('公開できない理由')).not.toBeInTheDocument(),
    );
    expect(button('シナリオ集へ公開')).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: '戦闘なし' }));
    await user.click(button('保存'));
    await waitFor(async () => expect((await getDraft(d.id)).scenarioType.noCombat).toBe(true));
    await waitFor(() => expect(button('保存')).toBeDisabled());
    expect(button('シナリオ集へ公開')).toBeDisabled();
  });

  it('公開版のある自分のシナリオで誤りがあると、公開し直すも押せない', async () => {
    const exam = scenarios.find((s) => s.id === 'sc-village-start')?.deck.find((n) => n.autoCombat);
    const deck = (await getDraft('sc-galleon')).deck;
    await patch('sc-galleon', {
      scenarioType: { noCombat: true, noCheck: false },
      deck: [
        ...deck,
        { id: 'exam', kind: 'scene', name: '試験', cards: [], autoCombat: exam?.autoCombat },
      ],
    });
    renderAt('/creator/scenarios/sc-galleon');
    expect(
      await within(await screen.findByRole('region', { name: '公開の前の確かめ' })).findByText(
        '公開できない理由',
      ),
    ).toBeInTheDocument();
    expect(button('公開し直す')).toBeDisabled();
  });
});

describe('読み取り専用（T9）', () => {
  it('他人のシナリオでは「公開の前に決めること」が開いていて、案内と確かめが無い', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion');
    expect(await screen.findByLabelText('概要')).toBeVisible();
    expect(screen.queryByRole('region', { name: '次にすること' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '公開の前の確かめ' })).not.toBeInTheDocument();
  });
});

describe('一覧から作る（T10）', () => {
  it('共有設定のテンプレートの文が無く、作った後の流れの文がある', async () => {
    renderAt('/creator/scenarios');
    expect(
      await screen.findByText(/作ったら、シーンを作り、選択肢で結末までつないで公開します/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/共有設定/)).not.toBeInTheDocument();
  });
});
