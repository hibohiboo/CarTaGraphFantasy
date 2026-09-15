import { ARCHETYPE_LABEL, type Character, deriveArchetype } from '@cartagraph/domain';
import { useNavigate } from 'react-router';
import {
  Button,
  CardGrid,
  ErrorNote,
  GameCard,
  Loading,
  PageHeader,
  Panel,
} from '../../components';
import { useCharacters, useMe } from '../../lib/queries';
import s from '../pages.module.css';

export function CharacterListPage() {
  const characters = useCharacters();
  const me = useMe();
  const navigate = useNavigate();

  if (characters.isPending || me.isPending) return <Loading />;
  if (characters.error) return <ErrorNote error={characters.error} />;

  const mine = (characters.data ?? []).filter((c) => c.ownerId === me.data?.id);
  const others = (characters.data ?? []).filter((c) => c.ownerId !== me.data?.id);

  return (
    <>
      <PageHeader
        title="キャラクター管理"
        crumb="PCは複数持てる。友人のPCを借りてパーティーを組むこともでき、貸したPCへの結果反映は所有者が決める。"
        actions={<Button onClick={() => navigate('/pl/characters/new')}>新しいPCを作る</Button>}
      />
      <div className={s.stack}>
        <Panel
          title="自分のPC"
          sub="能力値や戦闘スキルを得るたびに、参加できるシナリオが自然に広がる。"
        >
          <CardGrid min={150}>
            {mine.map((c) => (
              <CharacterCard key={c.id} c={c} />
            ))}
          </CardGrid>
        </Panel>
        <Panel
          title="借りられるPC"
          sub="他PLのPC。借りてドライバーになれる。所有者はナビゲーターとして参加するかを選べる。"
        >
          <CardGrid min={150}>
            {others.map((c) => (
              <CharacterCard key={c.id} c={c} />
            ))}
          </CardGrid>
        </Panel>
      </div>
    </>
  );
}

function CharacterCard({ c }: { c: Character }) {
  const navigate = useNavigate();
  const archetype = ARCHETYPE_LABEL[deriveArchetype(c)];
  return (
    <GameCard
      card={{ kind: 'character', name: c.name, description: `${archetype}／${c.ownerName}` }}
      portrait
      showDescription
      fluid
      onClick={() => navigate(`/pl/characters/${c.id}`)}
      title={`${c.name}のキャラクターシートを開く`}
    >
      <span className="u-small" style={{ color: 'var(--ink-soft)' }}>
        {c.deck.length}枚のカード
      </span>
    </GameCard>
  );
}
