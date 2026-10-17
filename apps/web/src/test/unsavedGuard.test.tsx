// 保存していない編集があるときの、画面内の移動の確かめ（docs/plans/2026-10-17-シナリオ製作の導線.md G6・T13）。
// シナリオ編集・シーン編集・結末のノードの編集で、リンク・戻る・「コピーして編集」を確かめる。

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { UNSAVED_CONFIRM_MESSAGE } from '@/shared/lib/useUnsavedGuard';
import { renderAt } from './renderAt';

const COPY = 'コピーして編集';
const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const draftCount = async () => (await api.get<ScenarioDraftView[]>('/scenario-drafts')).length;
const confirmWith = (answer: boolean) => vi.spyOn(window, 'confirm').mockReturnValue(answer);

afterEach(() => vi.restoreAllMocks());

describe('シナリオ編集（T13）', () => {
  it('タイトルを変えて保存せず「一覧へ戻る」を押すと確かめが出る。断ると移らず編集が残り、もう一度押すと再び出る。認めると移る', async () => {
    const user = userEvent.setup();
    const router = renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    await user.type(screen.getByLabelText('タイトル'), '（書きかけ）');

    const confirm = confirmWith(false);
    await user.click(screen.getByRole('link', { name: '一覧へ戻る' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenLastCalledWith(UNSAVED_CONFIRM_MESSAGE);
    expect(router.state.location.pathname).toBe('/creator/scenarios/sc-galleon');
    expect(screen.getByLabelText('タイトル')).toHaveValue('鉄鎖のガレオン船（書きかけ）');

    await user.click(screen.getByRole('link', { name: '一覧へ戻る' }));
    expect(confirm).toHaveBeenCalledTimes(2);

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: '一覧へ戻る' }));
    expect(confirm).toHaveBeenCalledTimes(3);
    await heading('自分のシナリオ');
  });

  it('保存した後は確かめずに移る。編集していなければ確かめない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    const confirm = confirmWith(false);
    await user.type(screen.getByLabelText('タイトル'), '（改）');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await screen.findByText('下書きを保存しました。');
    await user.click(screen.getByRole('link', { name: '一覧へ戻る' }));
    await heading('自分のシナリオ');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('戻る（navigate(-1)）でも確かめが出る', async () => {
    const user = userEvent.setup();
    const router = renderAt('/creator/scenarios');
    await heading('自分のシナリオ');
    await router.navigate('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    await user.type(screen.getByLabelText('タイトル'), '（書きかけ）');
    const confirm = confirmWith(false);
    await router.navigate(-1);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe('/creator/scenarios/sc-galleon');
  });

  it('検索・ハッシュだけが変わる移動は止めない', async () => {
    const user = userEvent.setup();
    const router = renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    await user.type(screen.getByLabelText('タイトル'), '（書きかけ）');
    const confirm = confirmWith(false);
    await router.navigate('/creator/scenarios/sc-galleon?a=1#b');
    expect(confirm).not.toHaveBeenCalled();
    expect(router.state.location.search).toBe('?a=1');
  });

  it('未保存のまま「コピーして編集」を押すと、コピーを作る前に確かめが出る。断るとコピーは作られず、認めるとコピーへ移る（2回目の確かめは出ない）', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    await user.type(screen.getByLabelText('タイトル'), '（書きかけ）');
    const before = await draftCount();

    const confirm = confirmWith(false);
    await user.click(screen.getByRole('button', { name: COPY }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(await draftCount()).toBe(before);
    expect(screen.getByLabelText('タイトル')).toHaveValue('鉄鎖のガレオン船（書きかけ）');

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: COPY }));
    await heading('鉄鎖のガレオン船のコピー');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await draftCount()).toBe(before + 1);
  });

  it('編集していなければ、コピーでも確かめは出ない', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon');
    await heading('鉄鎖のガレオン船');
    const confirm = confirmWith(false);
    await user.click(screen.getByRole('button', { name: COPY }));
    await heading('鉄鎖のガレオン船のコピー');
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('シーン編集・結末のノードの編集（T13）', () => {
  it('シーン編集：名前を変えて保存せずリンクで移ると確かめが出る。断ると留まり、認めると移る', async () => {
    const user = userEvent.setup();
    const router = renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await heading('3-2 奥の扉');
    await user.type(screen.getByLabelText('シーン名'), '（改）');
    const confirm = confirmWith(false);
    await user.click(screen.getByRole('link', { name: 'シナリオ編集へ戻る' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    expect(screen.getByLabelText('シーン名')).toHaveValue('3-2 奥の扉（改）');

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: 'シナリオ編集へ戻る' }));
    await screen.findByLabelText('タイトル');
  });

  it('シーン編集：保存した後は確かめずに移る', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-s2');
    await heading('3-2 奥の扉');
    const confirm = confirmWith(false);
    await user.type(screen.getByLabelText('シーン名'), '（改）');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await heading('3-2 奥の扉（改）');
    await user.click(screen.getByRole('link', { name: 'シナリオ編集へ戻る' }));
    await screen.findByLabelText('タイトル');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('結末のノードの編集：名前を変えて保存せずリンクで移ると確かめが出る', async () => {
    const user = userEvent.setup();
    const router = renderAt('/creator/scenarios/sc-mansion-mine/scenes/d-end');
    await screen.findByRole('heading', { name: '結末のノードの情報' });
    await user.type(screen.getByLabelText('結末のノードの名前'), '（改）');
    const confirm = confirmWith(false);
    await user.click(screen.getByRole('link', { name: 'シナリオ編集へ戻る' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/creator/scenarios/sc-mansion-mine/scenes/d-end');

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: 'シナリオ編集へ戻る' }));
    await screen.findByLabelText('タイトル');
  });
});
