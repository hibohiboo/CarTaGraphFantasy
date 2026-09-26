import type { CardDef } from '@cartagraph/domain';
import { useState } from 'react';
import { GameCard } from './GameCard';
import s from './PlayMat.module.css';

export interface PlayMatZone {
  label: string;
  /** GM/PLどちらが用意・操作するかの注記（例：「GMが用意」「PLが選ぶ」）。奥/手前の並び順で
   * 既に表現されているため必須ではない（2026-09-22ユーザー指摘：サンプル文言に見えるので省略可に） */
  note?: string;
  cards: CardDef[];
}

/**
 * 1画面で場の全体を俯瞰する簡易表示（試作HTML play-mat.html の移植。試作は削除済みで git 履歴にある）。
 * GMが用意するもの（シーン・場に出たカード）を奥（上）、PLが操作するもの（選択肢・パーティー）を
 * 手前（下）に積む「プレイマット式の奥行き表現」（docs/architecture/prototype-handover.md）。
 * 普段は`hideMeta`（アイコン＋1行の名前だけ）の小さな表示に固定し、タップした1枚だけ
 * 肖像・説明つきの大きな表示に切り替える（2026-09-22ユーザー指摘）。
 *
 * 提案カード（GMの裁定待ち）の特別な見た目は、本番のセッション画面（PlayPage）に
 * 組み込むときに合わせて追加する（今回のチュートリアルではセッションモデルを
 * 使わないため提案の概念自体が無い）。
 */
export function PlayMat({ zones }: { zones: PlayMatZone[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className={s.outer}>
      <div className={s.rail}>
        <span className={s.railLabel} data-pos="far">
          奥・GM
        </span>
        <span className={s.railLabel} data-pos="near">
          手前・PL
        </span>
      </div>
      <div className={s.mat}>
        {zones.map((zone) => (
          <div key={zone.label} className={s.zone}>
            <div className={s.zoneLabel}>
              {zone.label}
              {zone.note && <span className={s.note}>（{zone.note}）</span>}
            </div>
            <div className={s.chips}>
              {zone.cards.map((card) => {
                const expanded = card.id === expandedId;
                return (
                  <GameCard
                    key={card.id}
                    card={card}
                    width={expanded ? 190 : 64}
                    portrait
                    hideMeta={!expanded}
                    showDescription={expanded}
                    selected={expanded}
                    onClick={() => setExpandedId((id) => (id === card.id ? null : card.id))}
                    title={expanded ? '小さくする' : 'タップして詳しく見る'}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
