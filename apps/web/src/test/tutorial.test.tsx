// 旅立ちの酒場（/pl/tutorial）の、名乗りから冒険者として登録するまでの操作の連なり
// （docs/plans/2026-10-10-冒険者だけにする.md C3-T16・C3-T17）。
// キャラクターは能力値を選んだ時点で初めて保存する（途中で抜けても、能力値の無い PC を残さない。E8）。

import { abilitiesValid } from '@cartagraph/domain/character/creation';
import type { Character } from '@cartagraph/domain/character/model';
import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { ABILITY_PRESETS } from '@/pages/pl/tutorial/model/presets';
import { api } from '@/shared/api/api';
import { server } from '../mocks/node';
import { characterCreation } from '../mocks/rulesFiles';
import { renderAt } from './renderAt';

const characters = () => api.get<Character[]>('/characters');
const named = async (name: string) => (await characters()).filter((c) => c.name === name);

/** 情景描写→問いかけ→名乗る→腕試し、と進めて、得意の3択を出す */
async function toPresets(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: /次へ/ }));
  await user.click(await screen.findByRole('button', { name: /名を名乗る/ }));
  await user.type(screen.getByLabelText('名前'), '新人');
  await user.click(screen.getByRole('button', { name: '名乗る' }));
  await user.click(await screen.findByRole('button', { name: /腕試しをしていく/ }));
}

const preset = (name: string) => {
  const found = ABILITY_PRESETS.find((p) => p.name === name);
  if (!found) throw new Error(`プリセット「${name}」がありません`);
  return found;
};

describe('旅立ちの酒場：キャラクターを保存する時点', () => {
  it('3つのプリセットは、どれも作成のルールの配分（合計・範囲）を満たす', () => {
    expect(ABILITY_PRESETS).toHaveLength(3);
    for (const p of ABILITY_PRESETS)
      expect(abilitiesValid(p.abilities, characterCreation.abilities)).toBe(true);
  });

  it('名乗っただけでは PC が増えず、3択を選ぶと能力値・HP・行動値を持つ PC が1人増える', async () => {
    const user = userEvent.setup();
    const before = (await characters()).length;
    renderAt('/pl/tutorial');
    await toPresets(user);
    await screen.findByRole('button', { name: /力自慢/ });
    expect((await characters()).length).toBe(before);

    await user.click(screen.getByRole('button', { name: /力自慢/ }));
    await screen.findByText('旅には何か持たせてやろう');
    const [pc, ...rest] = await named('新人');
    expect(rest).toEqual([]);
    expect(pc).toMatchObject({
      abilities: preset('力自慢').abilities,
      hp: { current: characterCreation.initialHp, max: characterCreation.initialHp },
      baseActionValue: characterCreation.initialBaseActionValue,
      deck: [],
    });
  });

  it('最後まで進むと斬撃を持ち、「冒険者として旅立った」と出る', async () => {
    const user = userEvent.setup();
    renderAt('/pl/tutorial');
    await toPresets(user);
    await user.click(await screen.findByRole('button', { name: /身軽さ/ }));
    await user.click(await screen.findByRole('button', { name: /灯火のランタン/ }));
    await user.click(await screen.findByRole('button', { name: /冒険者として登録する/ }));
    expect(await screen.findByText('冒険者として旅立った。')).toBeInTheDocument();
    const [pc] = await named('新人');
    expect(pc?.abilities).toEqual(preset('身軽さ').abilities);
    expect(pc?.deck.map((c) => c.id)).toEqual(['c-lantern', 'c-slash']);
  });
});

describe('旅立ちの酒場：保存の失敗', () => {
  it('作成（POST）に失敗すると3択で止まり、エラーを表示し、PC は増えない', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/characters', () =>
        HttpResponse.json({ message: '能力値の配分がルールに合いません' }, { status: 422 }),
      ),
    );
    const before = (await characters()).length;
    renderAt('/pl/tutorial');
    await toPresets(user);
    await user.click(await screen.findByRole('button', { name: /力自慢/ }));
    expect(await screen.findByText('能力値の配分がルールに合いません')).toBeInTheDocument();
    expect(screen.queryByText('旅には何か持たせてやろう')).not.toBeInTheDocument();
    expect((await characters()).length).toBe(before);
  });

  it('カードの追加（PATCH）に失敗すると旅装で止まり、残る PC は能力値を持つ', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/characters/:id', () =>
        HttpResponse.json(
          { message: `CP予算（${characterCreation.cpBudget}）を超えています` },
          { status: 422 },
        ),
      ),
    );
    renderAt('/pl/tutorial');
    await toPresets(user);
    await user.click(await screen.findByRole('button', { name: /力自慢/ }));
    await user.click(await screen.findByRole('button', { name: /灯火のランタン/ }));
    expect(
      await screen.findByText(`CP予算（${characterCreation.cpBudget}）を超えています`),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /冒険者として登録する/ })).not.toBeInTheDocument();
    const [pc] = await named('新人');
    expect(pc?.abilities).toEqual(preset('力自慢').abilities);
    expect(pc?.deck).toEqual([]);
  });
});
