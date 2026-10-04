import { deriveArchetype } from '@cartagraph/domain/character/archetype';
import { ARCHETYPE_LABEL, type Character } from '@cartagraph/domain/character/model';
import { replayBlockedBy } from '@cartagraph/domain/scenario/replay';
import type { Recruitment } from '@cartagraph/domain/session/model';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCharacters } from '@/entities/character/api/queries';
import { useScenario } from '@/entities/scenario/api/queries';
import { useApply, usePlayFromRecruitment } from '@/entities/session/api/mutations';
import { useRecruitments } from '@/entities/session/api/queries';
import { useMe } from '@/entities/user/api/queries';
import s from '@/shared/ui/page.module.css';
import { Button, Chip, ChipGroup, ErrorNote, Loading, PageHeader } from '@/shared/ui/ui';

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
  // GM 不在の募集の入口は、専用の画面ではなくこの一覧の絞り込み（docs/backlog/gmless-session-publish.md）
  const [onlyGmless, setOnlyGmless] = useState(false);

  if (recruitments.isPending || characters.isPending || me.isPending) return <Loading />;
  if (recruitments.error) return <ErrorNote error={recruitments.error} />;
  if (characters.error) return <ErrorNote error={characters.error} />;

  const chars = characters.data ?? [];
  const myId = me.data?.id;
  const shown = (recruitments.data ?? []).filter((rc) => !onlyGmless || rc.kind === 'gmless');

  return (
    <>
      <PageHeader
        title="参加できるセッション"
        crumb="募集中のシナリオ。通常の募集は、前提を満たさなくても応募できる（最終判断はGM）。自分のPCのほか、他PLのPCを借りて応募することもできる。GM 不在の募集は、自分のPCですぐに始められる。"
      />
      <label className="u-row u-small">
        <input
          type="checkbox"
          checked={onlyGmless}
          onChange={(e) => setOnlyGmless(e.target.checked)}
        />
        GM 不在の募集だけ
      </label>
      <div className={s.cardsRow}>
        {shown.map((rc) => (
          <RecruitCard key={rc.id} rc={rc} chars={chars} myId={myId} />
        ))}
      </div>
    </>
  );
}

function RecruitCard({ rc, chars, myId }: { rc: Recruitment; chars: Character[]; myId?: string }) {
  const apply = useApply();
  const play = usePlayFromRecruitment();
  const navigate = useNavigate();
  // 再挑戦不可（docs/cartagraph/scenario-flow.md「連作・キャンペーンの表現：結末タグ」）の判定にシナリオの結末を使う
  const scenario = useScenario(rc.scenarioId);
  const gmless = rc.kind === 'gmless';
  const fit = fitOf(rc, chars);
  // GM 不在の募集は、自分が所有者の PC だけ（借りた PC は使えない。solo-village.md「適用範囲」）
  const candidates = gmless ? chars.filter((c) => c.ownerId === myId) : chars;
  const blocked = (c: Character) => (scenario.data ? !!replayBlockedBy(scenario.data, c) : false);
  const [picked, setPicked] = useState<string>();
  // 初期値（と、選んだ PC がクリア済みになったとき）は、選べる PC の先頭
  const characterId =
    candidates.find((c) => c.id === picked && !blocked(c))?.id ??
    candidates.find((c) => !blocked(c))?.id ??
    '';
  // 応募した人で判定する（借りたPCで応募しても応募済みと出す）
  const applied = rc.applicants.some((a) => a.userId === myId);
  const closed = !gmless && rc.applicants.length >= rc.capacity;
  const busy = apply.isPending || play.isPending;

  return (
    <article className={s.recruit}>
      <ChipGroup>
        <Chip tone="ink">シナリオ</Chip>
        {gmless && <Chip tone="ink">GM 不在</Chip>}
      </ChipGroup>
      <h2 className={s.recruitTitle}>{rc.scenarioTitle}</h2>
      <p className={s.recruitSub}>GM：{rc.gmName}</p>
      {rc.note && <p className={s.recruitSub}>{rc.note}</p>}
      {!gmless && (
        <span className={s.fit} data-fit={fit.fit}>
          {fit.label}
        </span>
      )}
      <hr className={s.recruitDivider} />
      <div className={s.recruitMeta}>
        <span>
          想定人数{' '}
          <strong>
            {rc.partySize.min}〜{rc.partySize.max}人
          </strong>
          {gmless ? '（1人で遊ぶ）' : `（応募 ${rc.applicants.length}/${rc.capacity}）`}
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
        {!gmless && applied ? (
          <p className={s.recruitNote}>応募済み。GMの確定を待っています。</p>
        ) : closed ? (
          <p className={s.recruitNote}>募集枠が埋まっています。</p>
        ) : (
          <>
            <select
              aria-label={gmless ? '始める PC' : '参加させるPC'}
              value={characterId}
              onChange={(e) => setPicked(e.target.value)}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id} disabled={blocked(c)}>
                  {c.name}（{ARCHETYPE_LABEL[deriveArchetype(c)]}
                  {c.ownerId !== myId ? `・${c.ownerName}から借用` : ''}）
                  {blocked(c) ? '（このシナリオはクリア済み）' : ''}
                </option>
              ))}
            </select>
            {gmless ? (
              <Button
                variant="ink"
                block
                disabled={busy || !characterId}
                onClick={() =>
                  play.mutate(
                    { recruitmentId: rc.id, characterId },
                    { onSuccess: (session) => navigate(`/pl/sessions/${session.id}/play`) },
                  )
                }
              >
                {play.isPending ? '始めています…' : 'この PC で始める'}
              </Button>
            ) : (
              <Button
                variant="ink"
                block
                disabled={busy || !characterId}
                onClick={() => apply.mutate({ recruitmentId: rc.id, characterId })}
              >
                {apply.isPending ? '応募中…' : '応募する'}
              </Button>
            )}
            {(apply.error || play.error) && <ErrorNote error={apply.error ?? play.error} />}
            {gmless ? (
              <p className={s.recruitNote}>
                応募は不要。自分の PC で、すぐに1人で始める。提案の扱い：
                {rc.proposalHandling === 'disabled' ? '提案不可' : 'GM が後から裁定'}
              </p>
            ) : (
              fit.fit === 'partial' && (
                <p className={s.recruitNote}>前提タグ不足ですが応募自体は可能です。</p>
              )
            )}
          </>
        )}
      </div>
    </article>
  );
}
