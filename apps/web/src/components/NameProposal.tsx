import type { CardDef } from '@cartagraph/domain';
import { useState } from 'react';
import s from '../pages/pages.module.css';
import { GameCard } from './GameCard';
import { HandDock, ProposeForm } from './play';
import { Button, ErrorNote, Panel } from './ui';

/**
 * 名乗りは自由入力なので、実際のプレイ画面と同じ「新たな選択肢を提案」の操作感
 * （提案カードを選ぶ→自由入力欄が開く→GMへの提案として送る）で行う。
 * 旅立ちの酒場（TutorialPage）と村スタート（VillageStartPage）の共通部品。
 */
const INTRODUCE_CARD: CardDef = {
  id: 'introduce',
  kind: 'choice',
  name: '＋\n名を名乗る',
  tags: [],
};

/** 「＋名を名乗る」の提案カードと、選ぶと開く名前の入力シート */
export function NameProposal({
  busy,
  error,
  onSubmit,
}: {
  /** 名乗った後、応答が返るまで true（二重送信を防ぐ） */
  busy: boolean;
  /** 名乗りに失敗したときのエラー。入力シートの暗幕の奥に隠れないよう、シートの中に出す */
  error?: unknown;
  onSubmit: (name: string) => void;
}) {
  const [introducing, setIntroducing] = useState(false);
  const [name, setName] = useState('');
  const submit = () => {
    if (busy || !name.trim()) return;
    onSubmit(name);
  };

  return (
    <>
      <HandDock
        hand={[]}
        onPlay={() => {}}
        extra={
          <GameCard
            card={INTRODUCE_CARD}
            variant="propose"
            width={110}
            centerName
            selected={introducing}
            onClick={() => setIntroducing((v) => !v)}
          />
        }
      />
      {/* position:fixedのシートに乗せる。スマホでソフトキーボードが開いても、
          入力欄とボタンが常にキーボードの上に見える（2026-09-22ユーザー指摘：
          入力時に下の「名乗る」等のボタンが見えなかった問題への対応） */}
      {introducing && (
        <div className={s.sheetOverlay}>
          <button
            type="button"
            className={s.sheetBackdrop}
            aria-label="入力をやめる"
            onClick={() => setIntroducing(false)}
          />
          <Panel className={s.proposeSheet}>
            <ProposeForm>
              <input
                type="text"
                aria-label="名前"
                placeholder="例：迅"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                // biome-ignore lint/a11y/noAutofocus: 提案カードを選んだ直後の主操作なので意図的にフォーカスする
                autoFocus
              />
              <Button size="sm" onClick={submit} disabled={busy || !name.trim()}>
                {busy ? '名乗っている…' : '名乗る'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIntroducing(false)}>
                やめる
              </Button>
            </ProposeForm>
            {error ? <ErrorNote error={error} /> : null}
          </Panel>
        </div>
      )}
      {/* シートを閉じているときは、ここにエラーを出す */}
      {!introducing && error ? <ErrorNote error={error} /> : null}
    </>
  );
}
