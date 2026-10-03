import { Link } from 'react-router';
import s from './pages.module.css';

/** 扉の線画（GameCardのフォールバックアイコンと同じ、細い金線の意匠に合わせている） */
const DOOR = (
  <svg viewBox="0 0 120 170" aria-hidden="true">
    <path d="M18 158V62a42 42 0 0 1 84 0v96" />
    <path d="M18 158h84" />
    <path d="M32 158V74a28 28 0 0 1 56 0v84" />
    <circle cx="60" cy="112" r="4.5" />
    <path d="M60 117.5 55.5 132h9z" />
  </svg>
);

/**
 * 最初に開く「入口」画面。カード1枚（扉の意匠）だけを置き、開くとホーム（/home）へ進む。
 * ロール別の情報一覧（旧トップページ）はホームへ移した（AppShell.tsx・HomePage.tsx参照）。
 */
export function EntrancePage() {
  return (
    <div className={s.entrance}>
      <Link to="/home" className={s.entranceCard}>
        <span className={s.entranceDoor}>{DOOR}</span>
        <h1 className={s.entranceTitle}>カルタグラフ</h1>
        <span className={s.entranceHint}>扉を開く</span>
      </Link>
      <p className="u-small u-dim u-mt">
        カードを開き、糸をたどって、世界を読む。進化型カードTRPGの世界へ。
      </p>
    </div>
  );
}
