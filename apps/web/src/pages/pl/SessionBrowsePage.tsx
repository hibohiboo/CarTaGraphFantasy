import {
  ARCHETYPE_LABEL,
  type Character,
  deriveArchetype,
  type Recruitment,
} from '@cartagraph/domain';
import { useState } from 'react';
import { Button, Chip, ChipGroup, ErrorNote, Loading, PageHeader } from '../../components';
import { useApply, useCharacters, useMe, useRecruitments } from '../../lib/queries';
import s from '../pages.module.css';

/** PCが持つタグ（結末タグ＋デッキのタグ）と募集の前提タグを突き合わせる。ソフトガイドなのでブロックはしない */
function fitOf(rc: Recruitment, chars: Character[]) {
  if (rc.prerequisiteTags.length === 0)
    return { fit: 'good' as const, label: '多くのPCが参加できます' };
  const anyFits = chars.some((c) => rc.prerequisiteTags.every((t) => hasTag(c, t)));
  if (anyFits) return { fit: 'good' as const, label: '前提を満たすPCがいます' };
  const missing = rc.prerequisiteTags.filter((t) => !chars.some((c) => hasTag(c, t)));
  return { fit: 'partial' as const, label: `${missing.join('・')}不足（応募は可能）` };
}

function hasTag(c: Character, tag: string) {
  return c.endingTags.includes(tag) || c.deck.some((card) => card.tags.includes(tag));
}

export function SessionBrowsePage() {
  const recruitments = useRecruitments();
  const characters = useCharacters();
  const me = useMe();

  if (recruitments.isPending || characters.isPending || me.isPending) return <Loading />;
  if (recruitments.error) return <ErrorNote error={recruitments.error} />;
  if (characters.error) return <ErrorNote error={characters.error} />;

  const chars = characters.data ?? [];
  const myId = me.data?.id;

  return (
    <>
      <PageHeader
        title="参加できるセッション"
        crumb="募集中のシナリオ。前提を満たさなくても応募できる（最終判断はGM）。自分のPCのほか、他PLのPCを借りて応募することもできる。"
      />
      <div className={s.cardsRow}>
        {(recruitments.data ?? []).map((rc) => (
          <RecruitCard key={rc.id} rc={rc} chars={chars} myId={myId} />
        ))}
      </div>
    </>
  );
}

function RecruitCard({ rc, chars, myId }: { rc: Recruitment; chars: Character[]; myId?: string }) {
  const apply = useApply();
  const fit = fitOf(rc, chars);
  const [characterId, setCharacterId] = useState(chars[0]?.id ?? '');
  const applied = rc.applicants.some((a) =>
    chars.some((c) => c.id === a.characterId && c.ownerId === myId),
  );
  const closed = rc.status === 'closed' || rc.applicants.length >= rc.capacity;

  return (
    <article className={s.recruit}>
      <Chip tone="ink">シナリオ</Chip>
      <h2 className={s.recruitTitle}>{rc.scenarioTitle}</h2>
      <p className={s.recruitSub}>GM：{rc.gmName}</p>
      <span className={s.fit} data-fit={fit.fit}>
        {fit.label}
      </span>
      <hr className={s.recruitDivider} />
      <div className={s.recruitMeta}>
        <span>
          想定人数{' '}
          <strong>
            {rc.partySize.min}〜{rc.partySize.max}人
          </strong>
          （応募 {rc.applicants.length}/{rc.capacity}）
        </span>
        <span>
          空間モデル{' '}
          <strong>
            {rc.spaceModel === '2d' ? '2次元' : rc.spaceModel === '1d' ? '1次元' : '戦闘なし'}
          </strong>
        </span>
        <span>
          推奨CP <strong>{rc.recommendedCp}枚分</strong>
        </span>
      </div>
      <div className="u-mt">
        <ChipGroup>
          {rc.prerequisiteTags.length === 0 && <Chip tone="ink">前提タグなし</Chip>}
          {rc.prerequisiteTags.map((t) => (
            <Chip key={t} tone="ink">
              {t}
            </Chip>
          ))}
          {rc.referenceTags.map((t) => (
            <Chip key={t} tone="ink">
              {t}
            </Chip>
          ))}
        </ChipGroup>
      </div>
      <div className={s.recruitApply}>
        {applied ? (
          <p className={s.recruitNote}>応募済み。GMの確定を待っています。</p>
        ) : closed ? (
          <p className={s.recruitNote}>募集枠が埋まっています。</p>
        ) : (
          <>
            <select
              aria-label="参加させるPC"
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
            >
              {chars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{ARCHETYPE_LABEL[deriveArchetype(c)]}
                  {c.ownerId !== myId ? `・${c.ownerName}から借用` : ''}）
                </option>
              ))}
            </select>
            <Button
              variant="ink"
              block
              disabled={apply.isPending || !characterId}
              onClick={() => apply.mutate({ recruitmentId: rc.id, characterId })}
            >
              {apply.isPending ? '応募中…' : '応募する'}
            </Button>
            {apply.error && <ErrorNote error={apply.error} />}
            {fit.fit === 'partial' && (
              <p className={s.recruitNote}>前提タグ不足ですが応募自体は可能です。</p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
