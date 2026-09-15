import { ARCHETYPE_LABEL, deriveArchetype } from '@cartagraph/domain';
import { Link, useParams } from 'react-router';
import {
  CardGrid,
  Chip,
  ChipGroup,
  ErrorNote,
  GameCard,
  Loading,
  PageHeader,
  Panel,
  Pips,
  RoleBadge,
} from '../../components';
import { useCharacter, useMe } from '../../lib/queries';
import s from '../pages.module.css';

export function CharacterSheetPage() {
  const { characterId = '' } = useParams();
  const character = useCharacter(characterId);
  const me = useMe();

  if (character.isPending) return <Loading />;
  if (character.error) return <ErrorNote error={character.error} />;
  const c = character.data;
  const archetype = deriveArchetype(c);
  const isMine = c.ownerId === me.data?.id;

  return (
    <>
      <PageHeader
        title={c.name}
        crumb={
          <>
            所有者：{isMine ? 'あなた' : c.ownerName} ／{' '}
            <Link to="/pl/characters">キャラクター一覧へ戻る</Link>
          </>
        }
        // biome-ignore lint/a11y/useValidAriaRole: RoleBadge の role は独自propで、ARIAのrole属性ではない
        actions={<RoleBadge role="pl">{ARCHETYPE_LABEL[archetype]}</RoleBadge>}
      />
      <div className={s.twoCol}>
        <aside className="u-stack">
          <GameCard
            card={{ kind: 'character', name: c.name, description: ARCHETYPE_LABEL[archetype] }}
            portrait
            showDescription
            width={180}
          />
          <Panel title="成長">
            <p className="u-small">
              CP <strong className="u-num">{c.cp.total - c.cp.spent}</strong> 残り（獲得{' '}
              {c.cp.total}・使用 {c.cp.spent}）
            </p>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>
                称号タグ（参加者から贈られ、所有者が反映を選んだもの）
              </div>
              <ChipGroup>
                {c.titles.length === 0 && <Chip tone="off">まだない</Chip>}
                {c.titles.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </ChipGroup>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>結末タグ（後続シナリオの前提タグと突き合わされる）</div>
              <ChipGroup>
                {c.endingTags.length === 0 && <Chip tone="off">まだない</Chip>}
                {c.endingTags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </ChipGroup>
            </div>
          </Panel>
        </aside>
        <div className="u-stack">
          <Panel
            title="能力値"
            sub={
              c.abilities
                ? archetype === 'adventurer'
                  ? '体・技・心＋2d6で探索判定。戦闘スキルを持つため濃密モードの戦闘にも参加できる。'
                  : '体・技・心＋2d6で判定する。戦闘スキルはまだ持たないため、濃密モードの戦闘には参加できない。'
                : '能力値を持たない旅人。選択肢を選ぶだけで進むビジュアルノベル的なシナリオに参加できる。'
            }
          >
            {c.abilities && (
              <>
                {(['body', 'skill', 'mind'] as const).map((k) => (
                  <div key={k} className={s.abilityRow}>
                    <span>{{ body: '体', skill: '技', mind: '心' }[k]}</span>
                    <Pips
                      value={c.abilities![k]}
                      label={{ body: '体', skill: '技', mind: '心' }[k]}
                    />
                  </div>
                ))}
                {c.hp && (
                  <div className={s.abilityRow}>
                    <span>HP</span>
                    <strong className="u-num">
                      {c.hp.current} / {c.hp.max}
                    </strong>
                  </div>
                )}
                {c.baseActionValue !== undefined && (
                  <div className={s.abilityRow}>
                    <span>基本行動値</span>
                    <strong className="u-num">{c.baseActionValue}</strong>
                  </div>
                )}
              </>
            )}
          </Panel>
          <Panel
            title="所持デッキ"
            sub="このキャラクターを構成するスキル・特徴・アイテム・装備。セッションごとに持ち込む組み合わせを変えられる。"
          >
            <CardGrid min={130}>
              {c.deck.map((card) => (
                <GameCard
                  key={card.id}
                  card={card}
                  fluid
                  showDescription
                  showTags
                  showCost={card.actionCost !== undefined ? 'action' : 'cp'}
                />
              ))}
            </CardGrid>
          </Panel>
        </div>
      </div>
    </>
  );
}
