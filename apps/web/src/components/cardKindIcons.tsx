import type { CardKind } from '@cartagraph/domain';
import type { ReactElement } from 'react';

/**
 * カード種別ごとの既定アイコン（portraitUrl未設定時のフォールバック）。線画1色・viewBox 24x24。
 * 色・線幅はCSS（GameCard.module.css の `.portrait svg`）が一括で当てるため、ここでは形だけ定義する
 * （個々のアイコンにfill/strokeを指定しない）。
 * tabifudaプロジェクト（packages/ui/src/components/cardIcons.tsx）の構成にならった
 * （2026-09-22、ユーザー指摘：ロケーションカードのアイコンが人物のままで種別と合っていなかった）。
 *
 * Record<CardKind, ...> で受けているため、CardKindに新しい種別が増えるとキー不足でtscエラーになる
 * （網羅性チェック）。
 */
export const CARD_KIND_ICONS: Record<CardKind, ReactElement> = {
  // 人物（人影）
  character: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  npc: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  // ロケーション（地図ピン）
  location: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  ),
  // 道具（手提げ袋）
  item: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 8V6.5a4 4 0 0 1 8 0V8" />
      <rect x="3.5" y="8" width="17" height="12" rx="2" />
    </svg>
  ),
  // 装備（刃物）
  equipment: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18 17 7" />
      <path d="M14 4l6 6" />
      <path d="M4 20l3-1 1-3" />
    </svg>
  ),
  // スキル（ひらめき・稲妻）
  skill: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  ),
  // 特徴（星）
  trait: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.4 5.6 6 .6-4.6 4 1.4 6-5.2-3.2L6.8 19.2l1.4-6-4.6-4 6-.6z" />
    </svg>
  ),
  // 選択肢（分岐）
  choice: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v7" />
      <path d="M12 10 6 20" />
      <path d="M12 10l6 10" />
    </svg>
  ),
  // 情報（i マーク）
  info: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 8v.01" strokeLinecap="round" strokeWidth={2.4} />
    </svg>
  ),
  // エネミー（盾状の紋章）
  enemy: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 8v6l-8 5-8-5V8z" />
      <path d="M9 11l1.5 1.5L9 14" />
      <path d="M15 11l-1.5 1.5L15 14" />
    </svg>
  ),
  // シーン（額縁の中の情景）
  scene: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 15l5-5 4 4 3-3 6 6" />
    </svg>
  ),
  // 関係性（重なる2つの輪）
  relation: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </svg>
  ),
};
