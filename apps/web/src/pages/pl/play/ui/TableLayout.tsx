import type { ReactNode } from 'react';
import s from './TableLayout.module.css';

/** 卓の外枠。領域を CSS grid で組む（広い画面：場面の札・栞／場のゾーン・語り／手札／パーティ。狭い画面は縦に積む）。
 * `<main>` は使わない（AppShell の `<main>` と入れ子になるため） */
export function TableLayout({
  placard,
  bookmark,
  field,
  story,
  hand,
  party,
}: {
  placard: ReactNode;
  bookmark: ReactNode;
  field: ReactNode;
  story: ReactNode;
  hand: ReactNode;
  party: ReactNode;
}) {
  return (
    <div className={s.table}>
      <div className={s.placard}>{placard}</div>
      <div className={s.bookmark}>{bookmark}</div>
      <div className={s.field}>{field}</div>
      <div className={s.story}>{story}</div>
      <div className={s.hand}>{hand}</div>
      <div className={s.party}>{party}</div>
    </div>
  );
}
