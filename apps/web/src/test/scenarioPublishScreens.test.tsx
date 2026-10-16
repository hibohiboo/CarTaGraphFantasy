// シナリオの下書きと公開：画面（docs/plans/2026-10-11-シナリオの下書きのAPI.md T14〜T17、
// docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。保存は下書きだけを変え、公開・公開し直す・非公開でファイルに書く。
// 保存先は既定で null（デモ。setup.ts が毎回戻す）。書き込みを確かめるテストだけ、偽の保存先を差し込む。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { setScenarioFileStore } from '../mocks/handlers';
import { server } from '../mocks/node';
import { renderAt } from './renderAt';

const SAVED = (id: string) => `scenarios/${id}.json に保存しました`;
const DEMO = 'デモのため保存されません（リロードで消えます）';
const DRAFT_SAVED = '下書きを保存しました。';
const NOT_DELIVERED = '保存した変更は、公開し直すまで GM・PL に届きません。';
const RELOAD_LOSES = /公開していない編集は、リロードで消えます/;
const NOT_AUTHOR = /製作者でないため編集できません/;

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
const createDraft = async (title: string) =>
  (await api.post<ScenarioDraftView>('/scenarios', { title })).draft;

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
    expect(within(header()).getByText('下書きのみ')).toBeInTheDocument();

    await user.click(button('シナリオ集へ公開'));
    expect(await screen.findByText(SAVED(id))).toBeInTheDocument();
    expect(within(header()).getByText('シナリオ集に公開中')).toBeInTheDocument();
    expect(written.map((s) => [s.id, s.libraryStatus])).toEqual([[id, 'published']]);

    await router.navigate('/gm/scenarios');
    await user.click(await screen.findByRole('link', { name: title }));
    await user.click(await screen.findByRole('button', { name: /この構成で募集を出す/ }));
    await screen.findByRole('heading', { name: '自分の募集' });
    expect(await screen.findAllByText(title)).not.toHaveLength(0);
  });

  it('公開する前は、GM のシナリオ一覧に出ない', async () => {
    const sc = await createDraft('まだ下書きの灯台');
    renderAt('/gm/scenarios');
    await screen.findByText('村はずれの一歩');
    expect(screen.queryByText(sc.title)).not.toBeInTheDocument();
  });
});

describe('シナリオ編集の公開・公開し直す・非公開・保存（T14）', () => {
  const openNew = async (title = '公開ボタンのテスト') => {
    const sc = await createDraft(title);
    renderAt(`/creator/scenarios/${sc.id}`);
    await screen.findByRole('heading', { level: 1, name: title });
    return sc;
  };

  it('デモ（保存先が無い）で公開すると、保存されないことを知らせる', async () => {
    const user = userEvent.setup();
    await openNew();
    await user.click(button('シナリオ集へ公開'));
    expect(await screen.findByText(DEMO)).toBeInTheDocument();
    expect(within(header()).getByText('シナリオ集に公開中')).toBeInTheDocument();
  });

  it('公開中のシナリオを非公開にすると、シナリオ集から外した状態で書き直して知らせ、また公開できる', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    renderAt('/creator/scenarios/sc-galleon');
    await screen.findByRole('heading', { level: 1, name: '鉄鎖のガレオン船' });
    await user.click(button('非公開にする'));
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
    expect(within(header()).getByText('シナリオ集から外している')).toBeInTheDocument();
    expect(written.map((s) => s.libraryStatus)).toEqual(['draft']);
    expect(button('シナリオ集へ公開')).toBeEnabled();
  });

  it('公開中のシナリオを保存しても書き込まず、変更ありと知らせる。「公開し直す」で書き込む', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    renderAt('/creator/scenarios/sc-galleon');
    await screen.findByRole('heading', { level: 1, name: '鉄鎖のガレオン船' });
    expect(screen.queryByText(RELOAD_LOSES)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '公開し直す' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('タイトル'), '（改）');
    await user.click(button('保存'));
    expect(await screen.findByText(DRAFT_SAVED)).toBeInTheDocument();
    expect(written).toEqual([]);
    expect(within(header()).getByText('公開版と違う変更あり')).toBeInTheDocument();
    expect(screen.getByText(NOT_DELIVERED)).toBeInTheDocument();
    expect(screen.getByText(RELOAD_LOSES)).toBeInTheDocument();

    await user.click(button('公開し直す'));
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
    expect(written.map((s) => s.title)).toEqual(['鉄鎖のガレオン船（改）']);
    await waitFor(() =>
      expect(within(header()).queryByText('公開版と違う変更あり')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(NOT_DELIVERED)).not.toBeInTheDocument();
    expect(screen.queryByText(RELOAD_LOSES)).not.toBeInTheDocument();
    expect(button('非公開にする')).toBeEnabled();
  });

  it('下書きのみのシナリオを保存すると、下書きの保存を知らせ、書き込まない。リロードで消える注意を出し続ける', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    await openNew('下書きの保存');
    expect(screen.getByText(RELOAD_LOSES)).toBeInTheDocument();
    await user.type(screen.getByLabelText('概要'), 'あらすじ');
    await user.click(button('保存'));
    expect(await screen.findByText(DRAFT_SAVED)).toBeInTheDocument();
    expect(screen.queryByText(/に保存しました/)).not.toBeInTheDocument();
    expect(screen.queryByText(DEMO)).not.toBeInTheDocument();
    expect(screen.getByText(RELOAD_LOSES)).toBeInTheDocument();
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

  // 移り先になっているシーンは、削除そのものが止まる（docs/plans/2026-10-07-選択肢の移り先と結末の編集.md D1）
  it('選択肢から指されているシーンは削除できず、保存も書き込みも起きず公開中のまま', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    // ガレオンの下書きの導入に、1つ目のシーンへ進む選択肢を足しておく
    const { draft: g } = await api.get<ScenarioDraftView>('/scenarios/sc-galleon/draft');
    await api.patch('/scenarios/sc-galleon/draft', {
      deck: g.deck.map((n) =>
        n.id === 'g-intro'
          ? {
              ...n,
              cards: [{ id: 'c-go', kind: 'choice', name: '桟橋へ', tags: [], nextNodeId: 'g-s1' }],
            }
          : n,
      ),
    });
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
    expect(within(header()).getByText('下書きのみ')).toBeInTheDocument();
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
});

describe('他人のシナリオは読むだけ（T16）', () => {
  it('シナリオ編集：公開版の値が出て、案内が出て、保存・公開・非公開の操作が無く、入力できない', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion');
    await screen.findByRole('heading', { level: 1, name: '灰色館の一夜' });
    expect(screen.getByText(NOT_AUTHOR)).toBeInTheDocument();
    expect(screen.getByLabelText('タイトル')).toHaveValue('灰色館の一夜');
    expect(screen.getByLabelText('タイトル')).toBeDisabled();
    for (const name of ['保存', 'シナリオ集へ公開', '公開し直す', '非公開にする'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(button('シーンを追加')).toBeDisabled();
    expect(within(header()).getByText('シナリオ集に公開中')).toBeInTheDocument();
    expect(screen.queryByText(RELOAD_LOSES)).not.toBeInTheDocument();
  });

  it('シーン編集：公開版のシーンが出て、案内が出て、保存できない（system のシナリオも同じ）', async () => {
    renderAt('/creator/scenarios/sc-village-always-win/scenes/vs-square');
    expect(await screen.findByText(NOT_AUTHOR)).toBeInTheDocument();
    expect(screen.getByText('（テスト用）迷い道')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(button('＋カードを追加')).toBeDisabled();
  });
});

describe('他人のシナリオの境界（読み取り専用）', () => {
  it('外した他人のシナリオは「シナリオ集から外している」と出る', async () => {
    const gray = await api.get<Scenario>('/scenarios/sc-gray-mansion');
    server.use(
      http.get('/api/scenarios/sc-gray-mansion', () =>
        HttpResponse.json({ ...gray, libraryStatus: 'draft' }),
      ),
    );
    renderAt('/creator/scenarios/sc-gray-mansion');
    expect(await screen.findByText(NOT_AUTHOR)).toBeInTheDocument();
    expect(within(header()).getByText('シナリオ集から外している')).toBeInTheDocument();
  });

  it('公開版も無い他人のシナリオは「見つかりません」', async () => {
    server.use(
      http.get('/api/scenarios/sc-hidden', () =>
        HttpResponse.json({ message: 'シナリオ が見つかりません' }, { status: 404 }),
      ),
      http.get('/api/scenarios/sc-hidden/draft', () =>
        HttpResponse.json({ message: '製作者でないため下書きを読めません' }, { status: 403 }),
      ),
    );
    renderAt('/creator/scenarios/sc-hidden');
    expect(await screen.findByRole('alert')).toHaveTextContent('シナリオ が見つかりません');
  });

  it('結末のノードも読み取り専用で、保存のボタンが無い', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion/scenes/d-end');
    expect(await screen.findByText(NOT_AUTHOR)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });
});

describe('編集画面の境界', () => {
  it('下書きの一覧が古いうちに、自分の新しい下書きを開いても編集できる（別のタブで作った直後など）', async () => {
    const router = renderAt('/creator/scenarios');
    await screen.findByRole('link', { name: '鉄鎖のガレオン船' });
    // 一覧を読み込んだ後に、画面を通さずに作る（一覧のキャッシュは古いまま）
    const sc = await createDraft('別のタブで作った下書き');
    await router.navigate(`/creator/scenarios/${sc.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: '別のタブで作った下書き' }),
    ).toBeInTheDocument();
    expect(within(header()).getByText('下書きのみ')).toBeInTheDocument();
    expect(screen.queryByText(NOT_AUTHOR)).not.toBeInTheDocument();
  });

  it('「じっくり進行に」して「通常進行に」戻して保存しても、公開版と違う変更ありにならない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon');
    const row = (await screen.findByText('1 鎖の桟橋')).closest('[data-kind]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'じっくり進行に' }));
    await user.click(within(row).getByRole('button', { name: '通常進行に' }));
    // 戻すと dense のキーごと消えるので、編集前と同じ（保存するものが無い）になる
    expect(button('保存')).toBeDisabled();
    expect(within(header()).queryByText('公開版と違う変更あり')).not.toBeInTheDocument();
  });

  it('シーン編集の「下書きを保存しました」は、別のシーンへ移ると出ない', async () => {
    const user = userEvent.setup();
    const router = renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await user.type(await screen.findByLabelText('目的（仮）'), 'x');
    await user.click(button('保存'));
    expect(await screen.findByText(DRAFT_SAVED)).toBeInTheDocument();
    await router.navigate('/creator/scenarios/sc-mansion-mine/scenes/d-s3');
    await screen.findByRole('heading', { level: 1, name: '3-3 隠し書庫' });
    expect(screen.queryByText(DRAFT_SAVED)).not.toBeInTheDocument();
  });
});

describe('シナリオ管理の一覧（T15）', () => {
  it('状態と、公開版と違う変更があることが出て、公開し直すと消える', async () => {
    await api.patch('/scenarios/sc-galleon/draft', { summary: '直しかけ' });
    const router = renderAt('/creator/scenarios');
    const rowOf = async (title: string) =>
      (await screen.findByRole('link', { name: title })).closest(
        '[data-scenario-row]',
      ) as HTMLElement;
    const row = await rowOf('鉄鎖のガレオン船');
    expect(within(row).getByText('シナリオ集に公開中')).toBeInTheDocument();
    expect(within(row).getByText('公開版と違う変更あり')).toBeInTheDocument();
    expect(
      within(await rowOf('涸れ井戸の底（下書き）')).getByText('下書きのみ'),
    ).toBeInTheDocument();

    await api.post('/scenarios/sc-galleon/publish');
    await router.navigate('/creator/scenarios/sc-galleon');
    await screen.findByRole('heading', { level: 1, name: '鉄鎖のガレオン船' });
    await router.navigate('/creator/scenarios');
    await waitFor(() => expect(screen.queryByText('公開版と違う変更あり')).not.toBeInTheDocument());
  });
});

describe('GM のシナリオ詳細（T17）', () => {
  it('シナリオ集から外したシナリオは、募集を出す操作が無く、案内が出る', async () => {
    await api.post('/scenarios/sc-galleon/unpublish');
    renderAt('/gm/scenarios/sc-galleon');
    expect(
      await screen.findByText('シナリオ集から外されているため、新しい募集を出せません。'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /この構成で募集を出す/ })).not.toBeInTheDocument();
  });

  it('公開版の無いシナリオ（涸れ井戸）は見つからない', async () => {
    renderAt('/gm/scenarios/sc-draft-well');
    expect(await screen.findByRole('alert')).toHaveTextContent('シナリオ が見つかりません');
  });

  it('一覧から隠しただけのテスト専用のシナリオは、募集を出せる（反対側）', async () => {
    renderAt('/gm/scenarios/sc-village-always-win');
    expect(await screen.findByRole('button', { name: /この構成で募集を出す/ })).toBeInTheDocument();
  });
});

describe('シーン編集の保存の知らせ', () => {
  it('公開中のシナリオのシーンを保存すると、下書きの保存を知らせ、書き込まず、リロードで消える注意が出る', async () => {
    const user = userEvent.setup();
    const written = fakeStore();
    renderAt('/creator/scenarios/sc-galleon/scenes/g-s1');
    await user.type(await screen.findByLabelText('目的（仮）'), '桟橋を渡る');
    await user.click(button('保存'));
    expect(await screen.findByText(DRAFT_SAVED)).toBeInTheDocument();
    expect(await screen.findByText(RELOAD_LOSES)).toBeInTheDocument();
    expect(written).toEqual([]);
  });

  it('下書きのみのシナリオのシーンを保存しても、下書きの保存を知らせる', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await user.type(await screen.findByLabelText('目的（仮）'), 'x');
    await user.click(button('保存'));
    expect(await screen.findByText(DRAFT_SAVED)).toBeInTheDocument();
    expect(screen.queryByText(/に保存しました/)).not.toBeInTheDocument();
  });

  it('画像を付けて保存し公開し直すと、ファイルには画像を書かず、公開版と下書きには残る（シナリオ公開の D4）', async () => {
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
    await screen.findByText(DRAFT_SAVED);
    await api.post('/scenarios/sc-galleon/publish');
    const card = (s: Scenario) =>
      s.deck.find((n) => n.id === 'g-s1')?.cards.find((c) => c.name === '桟橋の番人');
    expect(card(written[0] as Scenario)).not.toHaveProperty('portraitUrl');
    expect(card(await api.get<Scenario>('/scenarios/sc-galleon'))?.portraitUrl).toMatch(/^data:/);
    const { draft } = await api.get<ScenarioDraftView>('/scenarios/sc-galleon/draft');
    expect(card(draft)?.portraitUrl).toMatch(/^data:/);
  });
});

describe('知らせの寿命', () => {
  it('別のシナリオへ移ると、前のシナリオの知らせは出ない', async () => {
    const user = userEvent.setup();
    fakeStore();
    const router = renderAt('/creator/scenarios/sc-galleon');
    await user.click(await screen.findByRole('button', { name: '非公開にする' }));
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();

    await router.navigate('/creator/scenarios/sc-draft-well');
    await screen.findByRole('heading', { level: 1, name: '涸れ井戸の底（下書き）' });
    expect(screen.queryByText(SAVED('sc-galleon'))).not.toBeInTheDocument();
  });

  it('公開し直すのを待っている間は、前の公開の知らせを出さない', async () => {
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
    await user.click(await screen.findByRole('button', { name: '公開し直す' }));
    await waitFor(() => expect(button('保存中…')).toBeInTheDocument());
    release();
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
    await user.type(screen.getByLabelText('タイトル'), '2');
    await user.click(button('保存'));
    await user.click(await screen.findByRole('button', { name: '公開し直す' }));
    await waitFor(() => expect(button('保存中…')).toBeInTheDocument());
    expect(screen.queryByText(SAVED('sc-galleon'))).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(SAVED('sc-galleon'))).toBeInTheDocument();
  });
});
