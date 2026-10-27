import { PARTICIPANT_ROLE_LABEL, type Participant } from '@cartagraph/domain/session/model';
import { useCharacter } from '@/entities/character/api/queries';
import s from './PartyCard.module.css';

/** パーティの札。PC 1人につき1枚。キャラクターを読めないとき（読み込み中・エラー）は名前とロールだけにする
 * （PC の無い参加者は札にしないので、ここには来ない） */
export function PartyCard({ participant }: { participant: Participant }) {
  const character = useCharacter(participant.characterId ?? '').data;
  const name = character?.name ?? participant.characterName ?? participant.name;
  return (
    <li className={s.card}>
      <span className={s.name}>{name}</span>
      <span className={s.role}>{PARTICIPANT_ROLE_LABEL[participant.role]}</span>
      {character && (
        <dl className={s.stats}>
          <dt>体</dt>
          <dd>{character.abilities.body}</dd>
          <dt>技</dt>
          <dd>{character.abilities.skill}</dd>
          <dt>心</dt>
          <dd>{character.abilities.mind}</dd>
          <dt>HP</dt>
          <dd>
            {character.hp.current}/{character.hp.max}
          </dd>
        </dl>
      )}
    </li>
  );
}
