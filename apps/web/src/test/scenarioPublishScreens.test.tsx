// シナリオの公開で JSON に書き込む：画面（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。
// 保存先は既定で null（デモ。setup.ts が毎回戻す）。書き込みを確かめるテストだけ、偽の保存先を差し込む。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { setScenarioFileStore } from '../mocks/handlers';
import { renderAt } from './renderAt';

const SAVED = (id: string) => `scenarios/${id}.json に保存しました`;
const DEMO = 'デモのため保存されません（リロードで消えます）';

function fakeStore(fail?: string) {
  const written: Scenario[] = [];
  setScenarioFileStore({
    write: async (s) => {
      if (fail) throw new Error(fail);
      written.push(structuredClone(s));
    },
  });
  return written;
}

const header = () => screen.getByRole('banner');
const button = (name: string) => screen.getByRole('button', { name });

describe('作る→公開→GM が募集を出す（通し）', () => {
  it('新しく作ったシナリオは、公開すると JSON に書かれ、GM のシナリオ一覧に出て、募集を出せる', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    const title = '霧の灯台（公開テスト）';

    // GM の画面から始める（公開前に GM の一覧に出ないことは、下の「公開する前は」で確かめる）
    const router = renderAt('/gm/scenarios');
    await screen.findByRole('heading', { level: 1, name: 'シナリオを選ぶ' });
    await router.navigate('/creator/scenarios');
    await user.type(await screen.findByPlaceholderText('シナリオのタイトル'), title);
    await user.click(button('下書きを作成'));
    await screen.findByRole('heading', { level: 1, name: title });
    const id = router.state.location.pathname.split('/').pop() as string;
    expect(screen.getByText('下書き')).toBeInTheDocument();

    await user.click(button('シナリオ集へ公開'));
    expect(await screen.findByText(SAVED(id))).toBeInTheDocument();
    expect(screen.getByText('シナリオ集に公開中')).toBeInTheDocument();
    expect(written.map((s) => [s.id, s.libraryStatus])).toEqual([[id, 'published']]);

    await router.navigate('/gm/scenarios');
    await user.click(await screen.findByRole('link', { name: title }));
    await user.click(await screen.findByRole('button', { name: /この構成で募集を出す/ }));
    await screen.findByRole('heading', { name: '自分の募集' });
    expect(await screen.findAllByText(title)).not.toHaveLength(0);
  });

  it('公開する前は、GM のシナリオ一覧に出ない', async () => {
    const sc = await api.post<Scenario>('/scenarios', { title: 'まだ下書きの灯台' });
    renderAt('/gm/scenarios');
    await screen.findByText('村はずれの一歩');
    expect(screen.queryByText(sc.title)).not.toBeInTheDocument();
  });
});

describe('シナリオ編集の公開・非公開・保存', () => {
  const openNew = async (title = '公開ボタンのテスト') => {
    const sc = await api.post<Scenario>('/scenarios', { title });
    renderAt(`/creator/scenarios/${sc.id}`);
    await screen.findByRole('heading', { level: 1, name: title });
    return sc;
  };

  it('デモ（保存先が無い）で公開すると、保存されないことを知らせる', async () => {
    const user = userEvent.setup();
    await openNew();
    await user.click(button('シナリオ集へ公開'));
    expect(await screen.findByText(DEMO)).toBeInTheDocument();
    expect(screen.getByText('シナリオ集に公開中')).toBeInTheDocument();
  });

  it('公開中のシナリオを非公開にすると、下書きに戻り、draft で書き直して知らせる', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    renderAt('/creator/scenarios/sc-galleon');
    await screen.findByRole('heading', { level: 1, name: '鉄鎖のガレオン船' });
    await user.click(button('非公開にする'));
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
    expect(within(header()).getByText('下書き')).toBeInTheDocument();
    expect(written.map((s) => s.libraryStatus)).toEqual(['draft']);
  });

  it('公開中のシナリオを保存すると、書き直して知らせる', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    renderAt('/creator/scenarios/sc-galleon');
    const titleInput = await screen.findByLabelText('タイトル');
    await user.type(titleInput, '（改）');
    await user.click(button('保存'));
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
    expect(written.map((s) => s.title)).toEqual(['鉄鎖のガレオン船（改）']);
  });

  it('下書きを保存しても知らせは出ず、書き込まない', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    await openNew('下書きの保存');
    await user.type(screen.getByLabelText('概要'), 'あらすじ');
    await user.click(button('保存'));
    await waitFor(() => expect(button('保存')).toBeDisabled());
    expect(screen.queryByText(/に保存しました/)).not.toBeInTheDocument();
    expect(screen.queryByText(DEMO)).not.toBeInTheDocument();
    expect(written).toEqual([]);
  });

  it('編集中は公開・非公開を押せず「保存してから」と出る。保存すると押せる', async () => {
    const user = userEvent.setup();
    await openNew();
    await user.type(screen.getByLabelText('概要'), 'あらすじ');
    expect(button('シナリオ集へ公開')).toBeDisabled();
    expect(screen.getByText(/保存してから/)).toBeInTheDocument();
    await user.click(button('保存'));
    await waitFor(() => expect(button('シナリオ集へ公開')).toBeEnabled());
    expect(screen.queryByText(/保存してから/)).not.toBeInTheDocument();
  });

  it('公開中のシナリオも、編集中は「非公開にする」を押せない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon');
    await user.type(await screen.findByLabelText('タイトル'), 'x');
    expect(button('非公開にする')).toBeDisabled();
  });

  // 移り先になっているシーンは、削除そのものが止まる（docs/plans/2026-10-07-選択肢の移り先と結末の編集.md D1）。
  // 保存で 422 になる経路は scenarioPublish.test.ts「公開中のシナリオで参照が切れる保存は 422」が守る
  it('公開中のシナリオで、選択肢から指されているシーンは削除できず、保存も書き込みも起きず公開中のまま', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    // ガレオンの導入に、1つ目のシーンへ進む選択肢を足しておく（公開中のまま保存できる）
    const g = await api.get<Scenario>('/scenarios/sc-galleon');
    await api.patch('/scenarios/sc-galleon', {
      deck: g.deck.map((n) =>
        n.id === 'g-intro'
          ? {
              ...n,
              cards: [{ id: 'c-go', kind: 'choice', name: '桟橋へ', tags: [], nextNodeId: 'g-s1' }],
            }
          : n,
      ),
    });
    written.length = 0;
    renderAt('/creator/scenarios/sc-galleon');
    const s1 = (await screen.findByText('1 鎖の桟橋')).closest('li, div') as HTMLElement;
    await user.click(
      within(s1.parentElement as HTMLElement).getAllByRole('button', {
        name: '削除',
      })[0] as HTMLElement,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '『桟橋へ』（港の酒場）から指されているので削除できません',
    );
    expect(screen.getByText('1 鎖の桟橋')).toBeInTheDocument();
    expect(button('保存')).toBeDisabled();
    expect(within(header()).getByText('シナリオ集に公開中')).toBeInTheDocument();
    expect(written).toEqual([]);
  });

  it('保存先が失敗したら、誤りが出て状態は変わらない', async () => {
    const user = userEvent.setup();
    fakeStore('ディスクがいっぱい');
    await openNew();
    await user.click(button('シナリオ集へ公開'));
    expect(await screen.findByRole('alert')).toHaveTextContent('ディスクがいっぱい');
    expect(within(header()).getByText('下書き')).toBeInTheDocument();
  });

  it('デモ用の下書き（涸れ井戸）は公開できないと出る', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-draft-well');
    await screen.findByRole('heading', { level: 1, name: '涸れ井戸の底（下書き）' });
    await user.click(button('シナリオ集へ公開'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'デモ用のシナリオは公開・非公開を変えられません',
    );
  });

  it('他人のシナリオ（灰色館）を保存すると、製作者でないため変更できないと出る', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-gray-mansion');
    await user.type(await screen.findByLabelText('概要'), '（改）');
    await user.click(button('保存'));
    expect(await screen.findByRole('alert')).toHaveTextContent('製作者でないため変更できません');
  });
});

describe('シーン編集の保存の知らせ', () => {
  it('公開中のシナリオのシーンを保存すると、書き直して知らせる', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    renderAt('/creator/scenarios/sc-galleon/scenes/g-s1');
    await user.type(await screen.findByLabelText('目的（仮）'), '桟橋を渡る');
    await user.click(button('保存'));
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
    expect(written).toHaveLength(1);
  });

  it('デモでは、保存されないことを知らせる', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon/scenes/g-s1');
    await user.type(await screen.findByLabelText('目的（仮）'), '桟橋を渡る');
    await user.click(button('保存'));
    expect(await screen.findByText(DEMO)).toBeInTheDocument();
  });

  it('下書きのシーンを保存しても知らせは出ない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await user.type(await screen.findByLabelText('目的（仮）'), 'x');
    await user.click(button('保存'));
    await waitFor(() => expect(button('保存')).toBeDisabled());
    expect(screen.queryByText(/に保存しました/)).not.toBeInTheDocument();
    expect(screen.queryByText(DEMO)).not.toBeInTheDocument();
  });

  it('画像を付けて保存すると、ファイルには画像を書かず、画面（メモリ）には残る（D4）', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    renderAt('/creator/scenarios/sc-galleon/scenes/g-s1');
    await screen.findByRole('heading', { level: 1, name: '1 鎖の桟橋' });
    await user.click(screen.getByRole('button', { name: '＋カードを追加' }));
    await user.type(screen.getByLabelText('新しいカードの名前'), '桟橋の番人');
    await user.click(screen.getByRole('button', { name: '追加' }));
    const row = (await screen.findByText('桟橋の番人')).closest('[data-card-row]') as HTMLElement;
    await user.upload(
      within(row).getByLabelText('画像を選択'),
      new File(['dummy'], 'x.png', { type: 'image/png' }),
    );
    await within(row).findByText('画像を設定済み（未保存）');
    await user.click(button('保存'));
    await screen.findByText(SAVED('sc-galleon'));
    const card = (s: Scenario) =>
      s.deck.find((n) => n.id === 'g-s1')?.cards.find((c) => c.name === '桟橋の番人');
    expect(card(written[0] as Scenario)).not.toHaveProperty('portraitUrl');
    expect(card(await api.get<Scenario>('/scenarios/sc-galleon'))?.portraitUrl).toMatch(/^data:/);
  });
});

describe('知らせの寿命', () => {
  it('別のシナリオへ移ると、前のシナリオの知らせは出ない', async () => {
    const user = userEvent.setup();
    fakeStore();
    const router = renderAt('/creator/scenarios/sc-galleon');
    await user.type(await screen.findByLabelText('タイトル'), '（改）');
    await user.click(button('保存'));
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();

    await router.navigate('/creator/scenarios/sc-draft-well');
    await screen.findByRole('heading', { level: 1, name: '涸れ井戸の底（下書き）' });
    expect(screen.queryByText(SAVED('sc-galleon'))).not.toBeInTheDocument();
  });

  it('保存を待っている間は、前の保存の知らせを出さない', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    setScenarioFileStore({
      write: () =>
        new Promise<void>((r) => {
          release = r;
        }),
    });
    renderAt('/creator/scenarios/sc-galleon');
    await user.type(await screen.findByLabelText('タイトル'), '1');
    await user.click(button('保存'));
    await waitFor(() => expect(button('保存中…')).toBeInTheDocument());
    release();
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
    await user.type(screen.getByLabelText('タイトル'), '2');
    await user.click(button('保存'));
    await waitFor(() => expect(button('保存中…')).toBeInTheDocument());
    expect(screen.queryByText(SAVED('sc-galleon'))).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
  });
});
