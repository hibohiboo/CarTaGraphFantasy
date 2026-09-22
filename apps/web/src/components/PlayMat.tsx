import type { CardDef } from '@cartagraph/domain';
import { GameCard } from './GameCard';
import s from './PlayMat.module.css';

export interface PlayMatZone {
  label: string;
  /** GM/PLどちらが用意・操作するかの注記（例：「GMが用意」「PLが選ぶ」） */
  note: string;
  cards: CardDef[];
}

/**
 * 1画面で場の全体を俯瞰する簡易表示（docs/public/preview/play-mat.html の移植）。
 * GMが用意するもの（シーン・場に出たカード）を奥（上）、PLが操作するもの（選択肢・パーティー）を
 * 手前（下）に積む「プレイマット式の奥行き表現」（docs/architecture/prototype-handover.md）。
 * カードの詳しい中身はタップで個々のGameCardが見せる想定のため、ここでは常に
 * `hideMeta`（アイコン＋1行の名前だけ）の小さな表示に固定する。
 *
 * 現時点では読み取り専用（クリック不可）。提案カード（GMの裁定待ち）の特別な見た目は、
 * 本番のセッション画面（PlayPage）に組み込むときに合わせて追加する（今回のチュートリアルでは
 * セッションモデルを使わないため提案の概念自体が無い）。
 */
export function PlayMat({ zones }: { zones: PlayMatZone[] }) {
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
              {zone.label} <span className={s.note}>（{zone.note}）</span>
            </div>
            <div className={s.chips}>
              {zone.cards.map((card) => (
                <GameCard key={card.id} card={card} width={64} portrait hideMeta />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
