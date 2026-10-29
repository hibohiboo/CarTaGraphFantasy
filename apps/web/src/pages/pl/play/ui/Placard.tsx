import type { Session } from '@cartagraph/domain/session/model';
import s from './Placard.module.css';

/** 場面の札。シナリオ名（プレイ画面の h1）・いまの場所・進行を出す */
export function Placard({ session }: { session: Session }) {
  return (
    <header className={s.placard}>
      <h1 className={s.title}>{session.scenarioTitle}</h1>
      <p className={s.scene}>{session.currentScene.path}</p>
      <p className={s.mode}>{session.mode === 'dense' ? 'じっくり進行' : '通常進行'}</p>
    </header>
  );
}
