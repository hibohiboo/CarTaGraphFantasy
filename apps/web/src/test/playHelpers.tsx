// プレイ画面（卓）のテストで共有する手順。画面から出る操作は右上の栞の中にある（docs/plans/2026-10-27-P7-プレイ画面の卓.md D3）。

import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type User = ReturnType<typeof userEvent.setup>;

/** 栞を開き、「栞」のダイアログを返す */
export async function openBookmark(user: User) {
  await user.click(await screen.findByRole('button', { name: '栞を開く' }));
  return screen.findByRole('dialog', { name: '栞' });
}

/** 栞を開いて、中のリンクを返す */
export async function bookmarkLink(user: User, name: string) {
  await openBookmark(user);
  return screen.getByRole('link', { name });
}
