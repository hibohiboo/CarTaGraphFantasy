// GM 不在の募集の画面（docs/plans/2026-10-04-GM不在の募集.md「5. 新規テストケース（画面）」）。
// 機能の操作の連なりは機能名のファイルに置く（docs/process/rules/testing.md「種別と実行コマンド」）。

import type { Session } from '@cartagraph/domain/session/model';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { recruitments } from '../mocks/fixtures';
import {
  clearVillageWith,
  createGmlessRecruitment,
  DEAD_END,
  playFromRecruitment,
  recruitCard,
  recruitPanel,
} from './gmlessHelpers';
import { renderAt } from './renderAt';

/** シードの GM 不在の募集（rc-gmless）のメモ。題名と GM が同じ募集と見分けるのに使う */
const gmlessNote = (() => {
  const note = recruitments.find((r) => r.id === 'rc-gmless')?.note;
  if (!note) throw new Error('rc-gmless にメモがありません');
  return note;
})();

describe('GM 不在の募集', () => {
  const optionOf = (card: HTMLElement, name: RegExp) =>
    within(card).getByRole('option', { name }) as HTMLOptionElement;

  it('GM のシナリオ一覧に、公開済みになった村はずれの一歩が出る', async () => {
    renderAt('/gm/scenarios');
    expect(await screen.findByText('村はずれの一歩')).toBeInTheDocument();
  });

  it('シナリオ詳細：GM 不在を選ぶと募集人数が消え、提案の扱いが出る。提案不可のシナリオでは提案不可に固定', async () => {
    const user = userEvent.setup();
    renderAt('/gm/scenarios/sc-village-start');
    let p = await recruitPanel();
    expect(within(p).getByLabelText('募集人数（ドライバー候補＋PC）')).toBeInTheDocument();
    expect(within(p).queryByLabelText('提案の扱い')).not.toBeInTheDocument();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(p).queryByLabelText('募集人数（ドライバー候補＋PC）')).not.toBeInTheDocument();
    expect(within(p).getByLabelText('提案の扱い')).toHaveValue('gm-required');
    cleanup();
    renderAt('/gm/scenarios/sc-village-no-propose');
    p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(p).getByLabelText('提案の扱い')).toHaveValue('disabled');
    expect(within(p).getByLabelText('提案の扱い')).toBeDisabled();
  });

  it('シナリオ詳細：先へ進めないシーンの注意は、灰色館で出て村はずれでは出ない。外したシーンは注意から消え、提案不可なら抜けられないと出る', async () => {
    const user = userEvent.setup();
    renderAt('/gm/scenarios/sc-gray-mansion');
    const p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(p).getByText(DEAD_END)).toHaveTextContent('3-3 隠し書庫');
    expect(
      within(p).getByText(/提案を GM が移り先付きで採用すると抜けられます/),
    ).toBeInTheDocument();
    const deckPanel = screen
      .getByRole('heading', { name: 'シナリオデッキの取捨選択' })
      .closest('section')!;
    const library = within(deckPanel).getByText('3-3 隠し書庫').parentElement!;
    await user.click(within(library).getByRole('button', { name: '外す' }));
    expect(within(p).getByText(DEAD_END)).not.toHaveTextContent('3-3 隠し書庫');
    await user.selectOptions(within(p).getByLabelText('提案の扱い'), 'disabled');
    expect(within(p).getByText(/提案不可なので、行き止まりから抜けられません/)).toBeInTheDocument();
    cleanup();
    renderAt('/gm/scenarios/sc-village-start');
    const v = await recruitPanel();
    await user.click(within(v).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(v).queryByText(DEAD_END)).not.toBeInTheDocument();
  });

  it('シナリオ詳細：通常の募集では、自動戦闘のシーンがあるシナリオ（村はずれ）だけに注意が出る', async () => {
    renderAt('/gm/scenarios/sc-village-start');
    expect(
      within(await recruitPanel()).getByText(/通常の募集では、自動戦闘のシーンへ進めません/),
    ).toBeInTheDocument();
    cleanup();
    renderAt('/gm/scenarios/sc-gray-mansion');
    expect(
      within(await recruitPanel()).queryByText(/自動戦闘のシーンへ進めません/),
    ).not.toBeInTheDocument();
  });

  it('GM 不在で募集を出すと、GM のセッション管理の「自分の募集」に始まったセッション 0 件で出る', async () => {
    const user = userEvent.setup();
    renderAt('/gm/scenarios/sc-gray-mansion');
    const p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    await user.click(within(p).getByRole('button', { name: /この構成で募集を出す/ }));
    const mine = (await screen.findByRole('heading', { name: '自分の募集' })).closest('section')!;
    const card = (await within(mine).findAllByRole('heading', { name: '灰色館の一夜' }))
      .map((el) => el.closest('article')!)
      .find((a) => within(a).queryByText(/GM 不在/))!;
    expect(within(card).getByText(/始まったセッション 0 件/)).toBeInTheDocument();
  });

  it('PL の募集一覧：「GM 不在の募集だけ」で絞り込める', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions');
    await recruitCard('村はずれの一歩', 'ユウ');
    expect(screen.getAllByRole('heading', { name: '灰色館の一夜' }).length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText('GM 不在の募集だけ'));
    expect(screen.queryByRole('heading', { name: '灰色館の一夜' })).not.toBeInTheDocument();
    expect(await recruitCard('村はずれの一歩', 'ユウ')).toBeInTheDocument();
    await user.click(screen.getByLabelText('GM 不在の募集だけ'));
    expect(
      (await screen.findAllByRole('heading', { name: '灰色館の一夜' })).length,
    ).toBeGreaterThan(0);
  });

  it('PL の募集一覧：GM 不在の募集では自分の PC だけを選べ、「この PC で始める」でプレイ画面へ移る', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions');
    const card = await recruitCard('村はずれの一歩', 'ユウ');
    expect(within(card).getByText('GM 不在')).toBeInTheDocument();
    expect(optionOf(card, /^ジン/)).toBeInTheDocument();
    expect(within(card).queryByRole('option', { name: /アキラ/ })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'この PC で始める' }));
    expect(await screen.findByRole('button', { name: /村の広場へ向かう/ })).toBeInTheDocument();
  });

  it('再挑戦不可：結末タグを得たジンは、GM 不在の募集・通常の募集で「再挑戦不可」で選べず、初期値にならない。灰色館では選べる', async () => {
    await clearVillageWith('pc-jin');
    await api.post('/scenarios/sc-village-start/recruitments', { capacity: 2, note: '通常の村' });
    renderAt('/pl/sessions');
    await screen.findByRole('heading', { name: '参加できるセッション' });
    // テストで足した通常の村の募集も「村はずれの一歩・GM：ユウ」なので、シードの GM 不在の募集はメモで特定する
    const gmless = (await screen.findByText(gmlessNote)).closest('article')!;
    await waitFor(() => expect(optionOf(gmless, /ジン.*再挑戦不可/).disabled).toBe(true));
    expect(within(gmless).getByLabelText('始める PC')).toHaveValue('pc-akari');
    const normal = (await screen.findByText('通常の村')).closest('article')!;
    await waitFor(() => expect(optionOf(normal, /ジン.*再挑戦不可/).disabled).toBe(true));
    const mansion = await recruitCard('灰色館の一夜', '霧乃');
    expect(optionOf(mansion, /^ジン/).disabled).toBe(false);
  });

  it('プレイ画面：提案すると中断し、手札と提案のカードを押せない。却下のあと「続きを遊ぶ」で再開する', async () => {
    const user = userEvent.setup();
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    renderAt(`/pl/sessions/${s.id}/play`);
    await user.click(await screen.findByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '鍬を借りたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    expect(await screen.findByText('GM の裁定を待っています（中断中）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /村の広場へ向かう/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/裁定を待たず/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '続きを遊ぶ' })).not.toBeInTheDocument();

    const suspended = await api.get<Session>(`/sessions/${s.id}`);
    await api.post(`/sessions/${s.id}/proposals/${suspended.proposals[0].id}/reject`, {
      reason: '鍬は貸せない',
    });
    cleanup();
    renderAt(`/pl/sessions/${s.id}/play`);
    expect(await screen.findByText(/鍬は貸せない/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '続きを遊ぶ' }));
    expect(await screen.findByRole('button', { name: /村の広場へ向かう/ })).toBeEnabled();
  });

  it('プレイ画面：提案不可の GM 不在の募集から始めると、提案のカードが出ない', async () => {
    const rc = await createGmlessRecruitment('sc-village-start', { proposalHandling: 'disabled' });
    const s = await playFromRecruitment(rc.id, 'pc-jin');
    renderAt(`/pl/sessions/${s.id}/play`);
    await screen.findByRole('button', { name: /村の広場へ向かう/ });
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
  });

  it('プレイ画面：GM 不在の募集のセッションでも、使える条件で選べないカードと仮ルールの表示が出る', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    renderAt(`/pl/sessions/${s.id}/play`);
    const guild = await screen.findByRole('button', { name: /街の冒険者ギルドへ向かう/ });
    await waitFor(() => expect(guild).toBeDisabled());
    expect(screen.getByText(/仮ルール（GM不在）/)).toBeInTheDocument();
  });

  it('GM のセッション管理：GM 不在のセッションに印と、中断中なら「提案の裁定待ち」が出る。募集の件数が増える', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    await api.post(`/sessions/${s.id}/proposals`, { text: '鍬を借りたい' });
    renderAt('/gm/sessions');
    const mine = (await screen.findByRole('heading', { name: '自分の募集' })).closest('section')!;
    const card = (await within(mine).findByText(gmlessNote)).closest('article')!;
    expect(within(card).getByText(/始まったセッション 1 件/)).toBeInTheDocument();
    const running = screen.getByRole('heading', { name: 'GMとして進行中' }).closest('section')!;
    const row = within(running)
      .getAllByRole('link', { name: '村はずれの一歩' })
      .map((el) => el.closest('[data-session-row]') as HTMLElement)
      .find((r) => within(r).queryByText('提案の裁定待ち'))!;
    expect(within(row).getByText('GM 不在')).toBeInTheDocument();
  });

  it('GM の進行管理画面：GM 不在のセッションでは描写の枠が出ない。中断中も採用でき、状態は中断、終了できる。採用に移り先を選べる', async () => {
    const user = userEvent.setup();
    const s = await playFromRecruitment(
      (await createGmlessRecruitment('sc-gray-mansion')).id,
      'pc-jin',
    );
    await api.post(`/sessions/${s.id}/proposals`, { text: '地下へ降りたい' });
    renderAt(`/gm/sessions/${s.id}`);
    await screen.findByRole('heading', { name: '提案の裁定' });
    expect(screen.queryByRole('heading', { name: '描写と選択肢を配る' })).not.toBeInTheDocument();
    expect(screen.getByText('中断（提案の裁定待ち）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'セッションを終了する' })).toBeEnabled();
    const ticket = screen.getByText('地下へ降りたい').closest('article')!;
    const select = await within(ticket).findByLabelText('移り先');
    await within(select).findByRole('option', { name: '3-1 地下回廊' });
    await user.selectOptions(select, '3-1 地下回廊');
    await user.click(within(ticket).getByRole('button', { name: '採用してカード化' }));
    await within(ticket).findByText('採用済み');
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.hand.find((c) => c.tags.includes('GM生成'))?.nextNodeId).toBe('d-s1');
  });

  it('GM の進行管理画面：進行中の GM 不在のセッションでも、描写と選択肢の枠は出ない（GM は自分）', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    renderAt(`/gm/sessions/${s.id}`);
    await screen.findByRole('link', { name: 'ドライバーとしてプレイ画面へ' });
    expect(screen.queryByRole('heading', { name: '描写と選択肢を配る' })).not.toBeInTheDocument();
    // GM 不在のセッションの GM は、提案の裁定と終了だけ（モードは切り替えない）
    expect(screen.queryByRole('button', { name: /濃密モード/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'セッションを終了する' })).toBeEnabled();
  });

  it('ホーム：中断中のセッションが出て、リンク先はプレイ画面', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    await api.post(`/sessions/${s.id}/proposals`, { text: '鍬を借りたい' });
    renderAt('/home');
    // ルート一覧にも「村はずれの一歩」のリンクがあるので、セッションへのリンクが出るまで待つ
    await waitFor(() =>
      expect(
        screen.getAllByRole('link', { name: '村はずれの一歩' }).map((l) => l.getAttribute('href')),
      ).toContain(`/pl/sessions/${s.id}/play`),
    );
    expect(screen.getByText('中断中：GM の裁定待ち')).toBeInTheDocument();
    expect(screen.queryByText('中断中：再開できます')).not.toBeInTheDocument();
  });

  it('ホーム：GM が裁定すると、中断中のセッションに「再開できます」と出る', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    const suspended = await api.post<Session>(`/sessions/${s.id}/proposals`, {
      text: '鍬を借りたい',
    });
    await api.post(`/sessions/${s.id}/proposals/${suspended.proposals[0].id}/approve`, {
      cardName: '鍬を借りる',
    });
    renderAt('/home');
    expect(await screen.findByText('中断中：再開できます')).toBeInTheDocument();
    expect(screen.queryByText('中断中：GM の裁定待ち')).not.toBeInTheDocument();
  });

  it('通し：GM が GM 不在で募集 → PL が絞り込んでジンで始める → 提案して中断 → GM が採用 → 再開 → 結末 → ジンは再挑戦不可', async () => {
    const user = userEvent.setup();
    const router = renderAt('/gm/scenarios/sc-village-always-win');
    const p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    await user.click(within(p).getByRole('button', { name: /この構成で募集を出す/ }));
    await screen.findByRole('heading', { name: '自分の募集' });

    await router.navigate('/pl/sessions');
    await screen.findByRole('heading', { name: '参加できるセッション' });
    await user.click(screen.getByLabelText('GM 不在の募集だけ'));
    const card = await recruitCard('（テスト用）必ず合格する村はずれ', 'ユウ');
    await user.selectOptions(within(card).getByLabelText('始める PC'), 'pc-jin');
    await user.click(within(card).getByRole('button', { name: 'この PC で始める' }));
    await screen.findByRole('button', { name: /村の広場へ向かう/ });

    await user.click(screen.getByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '鍬を借りたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    await screen.findByText('GM の裁定を待っています（中断中）');

    await user.click(screen.getByRole('link', { name: 'GMの画面へ' }));
    const ticket = (await screen.findByText('鍬を借りたい')).closest('article')!;
    await user.click(within(ticket).getByRole('button', { name: '採用してカード化' }));
    await within(ticket).findByText('採用済み');
    await user.click(screen.getByRole('link', { name: 'ドライバーとしてプレイ画面へ' }));
    await user.click(await screen.findByRole('button', { name: '続きを遊ぶ' }));

    const press = async (name: RegExp) => {
      const button = await screen.findByRole('button', { name });
      await waitFor(() => expect(button).toBeEnabled());
      await user.click(button);
      await waitFor(() => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
    };
    for (const name of [
      /村の広場へ向かう/,
      /依頼「畑を荒らす猪」/,
      /柵で畑を囲む/,
      /お店へ行く/,
      /斬撃を習う/,
      /お店を出る/,
      /街の冒険者ギルドへ向かう/,
      /街の門をくぐる/,
    ])
      await press(name);
    const tactics = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(tactics).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(tactics).getByRole('button', { name: '戦闘を始める' }));
    await screen.findByText(/^1回目：\d+ラウンドで試験官に勝利した$/);
    await press(/合格の証を受け取る/);
    expect(
      await screen.findByRole('heading', { name: '結末「冒険者として旅立つ」' }),
    ).toBeInTheDocument();

    await router.navigate('/pl/sessions');
    const again = await recruitCard('（テスト用）必ず合格する村はずれ', 'ユウ');
    await waitFor(() => expect(optionOf(again, /ジン.*再挑戦不可/).disabled).toBe(true));
  });
});
