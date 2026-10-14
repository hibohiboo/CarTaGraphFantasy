// シナリオの版の画面（docs/plans/2026-10-14-セッションの独立.md T14〜T16。T13 は scenarioAuthoringScreens.test.tsx の通し）。
// 画面は、セッション・募集が進む版を読む。公開し直しは、自分が作者のシナリオの写しを API で行う。

import type { Character } from '@cartagraph/domain/character/model';
import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { createGmlessRecruitment, finishVillage } from './gmlessHelpers';
import { renderAt } from './renderAt';
import { editNode, publishVillageCopy, republishWith } from './scenarioVersionHelpers';

/** 版1から版2で、村の広場の「迷子の子ヤギ」のシーンを消す */
const dropGoat = (id: string) =>
  republishWith(id, (d) => ({
    deck: d.deck
      .filter((n) => n.id !== 'vs-quest-2')
      .map((n) => ({ ...n, cards: n.cards.filter((c) => c.nextNodeId !== 'vs-quest-2') })),
  }));

/** 通常の募集から GM が始めたセッション（GM は自分、ドライバーはジン） */
async function startNormal(scenarioId: string) {
  const rc = await api.post<Recruitment>(`/scenarios/${scenarioId}/recruitments`, { capacity: 1 });
  await api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' });
  return api.post<Session>(`/recruitments/${rc.id}/start`, {
    characterIds: ['pc-jin'],
    driverCharacterId: 'pc-jin',
  });
}

describe('GM のセッション管理は、セッションの版で移り先を出す（T15）', () => {
  it('版2でシーンを消しても、版1で始めたセッションの描写の移り先・提案の採用の移り先に残る', async () => {
    const id = await publishVillageCopy();
    const s = await startNormal(id);
    await dropGoat(id);
    await api.post(`/sessions/${s.id}/proposals`, { text: '探したい' });
    const user = userEvent.setup();
    renderAt(`/gm/sessions/${s.id}`);

    const ticket = (await screen.findByText('探したい')).closest('article') as HTMLElement;
    const adopt = await within(ticket).findByLabelText('移り先');
    await within(adopt).findByRole('option', { name: /迷子の子ヤギ/ });

    const panel = (await screen.findByRole('heading', { name: '描写と選択肢を配る' })).closest(
      'section',
    ) as HTMLElement;
    await user.click(within(panel).getByRole('button', { name: '選択肢を足す' }));
    const select = within(panel).getByLabelText('選択肢1の移り先');
    const labels = (await within(select).findAllByRole('option')).map((o) => o.textContent);
    expect(labels.some((l) => l?.includes('迷子の子ヤギ'))).toBe(true);
  });
});

describe('PL の募集一覧の再挑戦不可は、PC の結末タグのカードで決める（T16）', () => {
  it('再挑戦不可を外した版の募集でも、結末タグのカードを持つ PC は選べない。外した版の結末で得ていなければ、新しく付けた版でも選べる', async () => {
    // 版1で再挑戦不可の結末（村はずれの一歩の写し）を遊んだジンは、版2で外されても止まる
    const blockedId = await publishVillageCopy();
    await finishVillage(
      (
        await api.post<Session>(
          `/recruitments/${(await createGmlessRecruitment(blockedId)).id}/play`,
          { characterId: 'pc-jin' },
        )
      ).id,
    );
    await republishWith(blockedId, (d) => ({
      endings: d.endings.map(({ noReplay: _, ...e }) => e),
    }));
    await createGmlessRecruitment(blockedId, { note: '外した版の募集（GM 不在）' });
    await api.post(`/scenarios/${blockedId}/recruitments`, { capacity: 2, note: '外した版の募集' });

    // 版1で再挑戦不可なしで遊んだアカリは、版2で付けられても止まらない
    const openId = await publishVillageCopy();
    await republishWith(openId, (d) => ({
      endings: d.endings.map(({ noReplay: _, ...e }) => e),
    }));
    await finishVillage(
      (
        await api.post<Session>(
          `/recruitments/${(await createGmlessRecruitment(openId)).id}/play`,
          { characterId: 'pc-akari' },
        )
      ).id,
    );
    await republishWith(openId, (d) => ({
      endings: d.endings.map((e) => ({ ...e, noReplay: true })),
    }));
    await createGmlessRecruitment(openId, { note: '付けた版の募集（GM 不在）' });

    renderAt('/pl/sessions');
    await screen.findByRole('heading', { name: '参加できるセッション' });
    const option = (card: HTMLElement, name: RegExp) =>
      within(card).getByRole('option', { name }) as HTMLOptionElement;
    const cardOf = async (note: string) =>
      (await screen.findByText(note)).closest('article') as HTMLElement;

    for (const note of ['外した版の募集（GM 不在）', '外した版の募集']) {
      const card = await cardOf(note);
      expect(option(card, /ジン.*再挑戦不可/).disabled).toBe(true);
    }
    const open = await cardOf('付けた版の募集（GM 不在）');
    await waitFor(() => expect(option(open, /^アカリ/).disabled).toBe(false));
    expect(within(open).queryByRole('option', { name: /アカリ.*再挑戦不可/ })).toBeNull();
  });
});

describe('ソロ開始の自動戦闘は、始めたときの版の敵で解決する（T14）', () => {
  it('ソロ開始の後に敵を強くして公開し直しても、画面の操作で版1の敵に勝ち、結末タグのカードは版1のもの', async () => {
    const user = userEvent.setup();
    const id = await publishVillageCopy();
    const s = await api.post<Session>(`/scenarios/${id}/start-solo`, { name: '新人' });
    await republishWith(id, (d) => ({
      deck: editNode(d.deck, 'vs-exam', (n) => ({
        ...n,
        autoCombat: n.autoCombat && {
          ...n.autoCombat,
          enemy: { ...n.autoCombat.enemy, hp: 9999 },
        },
      })),
      endings: d.endings.map((e) => ({ ...e, grantsTag: '別の結末タグ' })),
    }));
    for (const cardId of [
      'vs-to-square',
      'vs-to-quest-0',
      'vs-quest-0-body',
      'vs-to-shop',
      'vs-learn-c-slash',
      'vs-shop-leave',
      'vs-to-guild',
      'vs-to-exam',
    ])
      await api.post(`/sessions/${s.id}/play`, { cardId });

    renderAt(`/pl/sessions/${s.id}/play`);
    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    expect(await screen.findByText(/^1回目：\d+ラウンドで試験官に勝利した$/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /合格の証を受け取る/ }));
    expect(await screen.findByText(/結末タグ『冒険者になった』を得た。/)).toBeInTheDocument();

    const done = await api.get<Session>(`/sessions/${s.id}`);
    const pcId = done.participants.find((p) => p.role === 'driver')?.characterId;
    const pc = (await api.get<Character[]>('/characters')).find((c) => c.id === pcId);
    expect(pc?.deck.find((c) => c.ending?.scenarioId === id)?.name).toBe('冒険者になった');
  });
});
