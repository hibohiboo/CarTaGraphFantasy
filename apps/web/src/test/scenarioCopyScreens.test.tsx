// シナリオのコピー：画面（docs/plans/2026-10-14-シナリオのコピー.md T8〜T11、
// docs/cartagraph/scenario-flow.md「シナリオのコピー」）。入口はシナリオ編集の「コピーして編集」だけ（D2）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { server } from '../mocks/node';
import { renderAt } from './renderAt';
import { patchDraft, publish } from './scenarioVersionHelpers';

const COPY = 'コピーして編集';
const NOT_AUTHOR = /製作者でないため編集できません/;
const header = () => screen.getByRole('banner');
const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const draftCount = async () => (await api.get<ScenarioDraftView[]>('/scenario-drafts')).length;
const copyViaApi = async (id: string) =>
  (await api.post<ScenarioDraftView>(`/scenarios/${id}/copy`)).draft.id;
/** 親を公開して、そのコピーも公開する（GM の詳細は公開版を読む） */
const publishedCopyOf = async (id: string) => {
  const copied = await copyViaApi(id);
  await publish(copied);
  return copied;
};
const versionsRoute = '/api/scenarios/:id/versions/:version';
const notFoundBody = { message: 'シナリオの版 が見つかりません' };

describe('他人のシナリオからのコピー（T8）', () => {
  it('「コピーして編集」を押すと、コピーのシナリオ編集へ移る。親の1行が出て、押すと元の読み取り専用の画面へ戻る', async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = renderAt('/creator/scenarios/sc-gray-mansion');
    await heading('灰色館の一夜');
    expect(screen.getByText(NOT_AUTHOR)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: COPY }));

    await heading('灰色館の一夜のコピー');
    expect(router.state.location.pathname).not.toBe('/creator/scenarios/sc-gray-mansion');
    expect(screen.queryByText(NOT_AUTHOR)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    expect(screen.getByLabelText('タイトル')).toBeEnabled();
    expect(within(header()).getByText('下書きのみ')).toBeInTheDocument();
    const line = await screen.findByTestId('copied-from');
    expect(line).toHaveTextContent('灰色館の一夜（作者：琴音）のコピー');

    await user.click(within(line).getByRole('link', { name: '灰色館の一夜（作者：琴音）' }));
    await heading('灰色館の一夜');
    expect(await screen.findByText(NOT_AUTHOR)).toBeInTheDocument();

    await router.navigate('/creator/scenarios');
    expect(await screen.findByRole('link', { name: '灰色館の一夜のコピー' })).toBeInTheDocument();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('コピーの失敗と二重押し（T8b）', () => {
  it('コピーが失敗すると誤りが出て移らず、ボタンがまた押せる（読み取り専用の画面でも）', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/scenarios/:id/copy', () =>
        HttpResponse.json({ message: 'シナリオ が見つかりません' }, { status: 404 }),
      ),
    );
    renderAt('/creator/scenarios/sc-gray-mansion');
    await heading('灰色館の一夜');
    await user.click(screen.getByRole('button', { name: COPY }));
    expect(await screen.findByRole('alert')).toHaveTextContent('シナリオ が見つかりません');
    expect(screen.getByRole('heading', { level: 1, name: '灰色館の一夜' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: COPY })).toBeEnabled());
  });

  it('続けて2回押しても、コピーは1件だけ増える', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion');
    await heading('灰色館の一夜');
    const before = await draftCount();
    const copyRequests: string[] = [];
    const onStart = ({ request }: { request: Request }) => {
      if (request.url.endsWith('/copy')) copyRequests.push(request.url);
    };
    server.events.on('request:start', onStart);
    const btn = screen.getByRole('button', { name: COPY });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await heading('灰色館の一夜のコピー');
    server.events.removeListener('request:start', onStart);
    expect(copyRequests).toHaveLength(1);
    expect(await draftCount()).toBe(before + 1);
  });

  it('未保存の編集があっても確かめて認めればコピーでき、コピーに写るのは公開版（編集中の下書きではない）', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const router = renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    await user.type(screen.getByLabelText('タイトル'), '（書きかけ）');
    expect(screen.getByRole('button', { name: COPY })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: COPY }));
    await heading('鉄鎖のガレオン船のコピー');
    const id = router.state.location.pathname.split('/').pop() as string;
    const d = (await api.get<ScenarioDraftView>(`/scenarios/${id}/draft`)).draft;
    expect(d.title).toBe('鉄鎖のガレオン船のコピー');
  });
});

describe('自分のシナリオ（T9）', () => {
  it('公開版のある自分のシナリオには出る（外した後も）。公開版の無い自分の下書きには出ない', async () => {
    renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    expect(screen.getByRole('button', { name: COPY })).toBeInTheDocument();
  });

  it('シナリオ集から外した後も出る', async () => {
    await api.post('/scenarios/sc-galleon/unpublish');
    renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    expect(within(header()).getByText('シナリオ集から外している')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: COPY })).toBeInTheDocument();
  });

  it('公開版の無い自分の下書きには出ない', async () => {
    renderAt('/creator/scenarios/sc-draft-well');
    await screen.findByRole('heading', { level: 1 });
    expect(within(header()).getByText('下書きのみ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: COPY })).not.toBeInTheDocument();
  });
});

describe('置かない所（T9b）', () => {
  it('GM のシナリオ一覧・シナリオのカスタマイズと募集（親のあるコピーでも）・シーン編集に「コピーして編集」が無い', async () => {
    const copied = await publishedCopyOf('sc-galleon');
    const router = renderAt('/gm/scenarios');
    await screen.findByRole('heading', { level: 1, name: 'シナリオを選ぶ' });
    await screen.findByText('鉄鎖のガレオン船');
    expect(screen.queryByRole('button', { name: COPY })).not.toBeInTheDocument();

    await router.navigate(`/gm/scenarios/${copied}`);
    await heading('鉄鎖のガレオン船のコピー');
    expect(screen.queryByRole('button', { name: COPY })).not.toBeInTheDocument();

    await router.navigate('/creator/scenarios/sc-gray-mansion/scenes/d-end');
    expect(await screen.findByText(NOT_AUTHOR)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: COPY })).not.toBeInTheDocument();

    await router.navigate('/creator/scenarios/sc-galleon/scenes/g-s1');
    await screen.findByRole('button', { name: '保存' });
    expect(screen.queryByRole('button', { name: COPY })).not.toBeInTheDocument();
  });
});

describe('GM のシナリオのカスタマイズと募集（T10）', () => {
  it('親のあるシナリオには親の1行が出て、親のないシナリオには出ない', async () => {
    const copied = await publishedCopyOf('sc-galleon');
    const router = renderAt(`/gm/scenarios/${copied}`);
    await heading('鉄鎖のガレオン船のコピー');
    expect(await screen.findByTestId('copied-from')).toHaveTextContent(
      '鉄鎖のガレオン船（作者：ユウ）のコピー',
    );
    await router.navigate('/gm/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    expect(screen.queryByTestId('copied-from')).not.toBeInTheDocument();
  });

  it('親を改題して公開し直しても、親の題名はコピーした版（版1）のもの', async () => {
    const copied = await publishedCopyOf('sc-galleon');
    await patchDraft('sc-galleon', { title: '改題したガレオン' });
    await publish('sc-galleon');
    renderAt(`/gm/scenarios/${copied}`);
    expect(await screen.findByTestId('copied-from')).toHaveTextContent(
      '鉄鎖のガレオン船（作者：ユウ）のコピー',
    );
    expect(screen.getByRole('link', { name: '鉄鎖のガレオン船（作者：ユウ）' })).toHaveAttribute(
      'href',
      expect.stringContaining('/creator/scenarios/sc-galleon'),
    );
  });
});

describe('親が読めないとき（T11）', () => {
  it.each([
    ['404', () => HttpResponse.json(notFoundBody, { status: 404 })],
    ['通信失敗', () => HttpResponse.error()],
  ])('親の版が読めない（%s）ときは、親の1行を出さず、画面は壊れない', async (_, response) => {
    const copied = await publishedCopyOf('sc-galleon');
    server.use(http.get(versionsRoute, response));
    renderAt(`/gm/scenarios/${copied}`);
    await heading('鉄鎖のガレオン船のコピー');
    // 親の題名が取れないのに「…のコピー」だけは出さない（見出しの「鉄鎖のガレオン船のコピー」は題名）
    await waitFor(() => expect(screen.queryByTestId('copied-from')).not.toBeInTheDocument());
    expect(screen.queryByText(/（作者：/)).not.toBeInTheDocument();
  });

  it('読み込み中は出さない', async () => {
    const copied = await publishedCopyOf('sc-galleon');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let parent: Scenario | undefined;
    server.use(
      http.get(versionsRoute, async () => {
        await gate;
        parent = await api.get<Scenario>('/scenarios/sc-galleon');
        return HttpResponse.json(parent);
      }),
    );
    renderAt(`/gm/scenarios/${copied}`);
    await heading('鉄鎖のガレオン船のコピー');
    expect(screen.queryByTestId('copied-from')).not.toBeInTheDocument();
    release();
    expect(await screen.findByTestId('copied-from')).toBeInTheDocument();
  });

  it('親をシナリオ集から外した後も、親の1行は出る', async () => {
    const copied = await publishedCopyOf('sc-galleon');
    await api.post('/scenarios/sc-galleon/unpublish');
    renderAt(`/gm/scenarios/${copied}`);
    expect(await screen.findByTestId('copied-from')).toHaveTextContent(
      '鉄鎖のガレオン船（作者：ユウ）のコピー',
    );
  });
});
