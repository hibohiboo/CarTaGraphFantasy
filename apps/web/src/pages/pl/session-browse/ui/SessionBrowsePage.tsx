import type { Character } from '@cartagraph/domain/character/model';
import { replayBlockedBy } from '@cartagraph/domain/scenario/replay';
import { scenarioTypeLabel } from '@cartagraph/domain/scenario/type';
import type { Recruitment } from '@cartagraph/domain/session/model';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCharacters } from '@/entities/character/api/queries';
import { useScenario } from '@/entities/scenario/api/queries';
import { useApply, usePlayFromRecruitment } from '@/entities/session/api/mutations';
import { useRecruitments } from '@/entities/session/api/queries';
import { useMe } from '@/entities/user/api/queries';
import s from '@/shared/ui/page.module.css';
import { Button, Chip, ChipGroup, EmptyNote, ErrorNote, Loading, PageHeader } from '@/shared/ui/ui';

/**
 * PCが持つタグ（結末タグ＋デッキのタグ）と募集の前提タグを突き合わせる。ソフトガイドなのでブロックはしない
 * （GM 不在の募集でも表示だけはする。unlock.md「強制力」）
 */
function fitOf(rc: Recruitment, chars: Character[]) {
  if (rc.prerequisiteTags.length === 0)
    return { fit: 'good' as const, label: '多くのPCが参加できます' };
  const anyFits = chars.some((c) => rc.prerequisiteTags.every((t) => hasTag(c, t)));
  if (anyFits) return { fit: 'good' as const, label: '前提を満たすPCがいます' };
  const missing = rc.prerequisiteTags.filter((t) => !chars.some((c) => hasTag(c, t)));
  const can = rc.kind === 'gmless' ? '始めることは可能' : '応募は可能';
  return { fit: 'partial' as const, label: `${missing.join('・')}不足（${can}）` };
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
      {shown.length === 0 && (
        <EmptyNote>
          {onlyGmless ? 'GM 不在の募集はありません。' : '募集中のシナリオはありません。'}
        </EmptyNote>
      )}
      <div className={s.cardsRow}>
        {shown.map((rc) => (
          <RecruitCard key={rc.id} rc={rc} chars={chars} myId={myId} />
        ))}
      </div>
    </>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 既存の違反。分けるまで個別に抑える（docs/architecture/known-issues.md「複雑度・行数の上限を超える既存のコード」）
function RecruitCard({ rc, chars, myId }: { rc: Recruitment; chars: Character[]; myId?: string }) {
  const apply = useApply();
  const play = usePlayFromRecruitment();
  const navigate = useNavigate();
  // 再挑戦不可（docs/cartagraph/scenario-flow.md「連作・キャンペーンの表現：結末タグ」）の判定にシナリオの結末を使う
  const scenario = useScenario(rc.scenarioId);
  const gmless = rc.kind === 'gmless';
  // GM 不在の募集は、自分が所有者の PC だけ（借りた PC は使えない。solo-village.md「適用範囲」）
  const candidates = gmless ? chars.filter((c) => c.ownerId === myId) : chars;
  const fit = fitOf(rc, candidates);
  const blocked = (c: Character) => (scenario.data ? !!replayBlockedBy(scenario.data, c) : false);
  const [picked, setPicked] = useState<string>();
  // 初期値（と、選んだ PC が再挑戦不可になったとき）は、選べる PC の先頭
  const characterId =
    candidates.find((c) => c.id === picked && !blocked(c))?.id ??
    candidates.find((c) => !blocked(c))?.id ??
    '';
  // 応募した人で判定する（借りたPCで応募しても応募済みと出す）
  const applied = rc.applicants.some((a) => a.userId === myId);
  const closed = !gmless && rc.applicants.length >= rc.capacity;
  // 再挑戦不可の判定にシナリオが要るので、読み込むまでは始めない・応募しない
  const busy = apply.isPending || play.isPending || scenario.isPending || !!scenario.error;

  return (
    <article className={s.recruit}>
      <ChipGroup>
        <Chip tone="ink">シナリオ</Chip>
        {gmless && <Chip tone="ink">GM 不在</Chip>}
      </ChipGroup>
      <h2 className={s.recruitTitle}>{rc.scenarioTitle}</h2>
      <p className={s.recruitSub}>GM：{rc.gmName}</p>
      {rc.note && <p className={s.recruitSub}>{rc.note}</p>}
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
          {gmless ? '（1人で遊ぶ）' : `（応募 ${rc.applicants.length}/${rc.capacity}）`}
        </span>
        <span>
          空間モデル{' '}
          <strong>
            {rc.spaceModel === '2d' ? '2次元' : rc.spaceModel === '1d' ? '1次元' : '空間なし'}
          </strong>
        </span>
        <span>
          推奨CP <strong>{rc.recommendedCp}枚分</strong>
        </span>
      </div>
      <div className="u-mt">
        <ChipGroup>
          <span data-testid="scenario-type">
            <Chip tone="ink">タイプ：{scenarioTypeLabel(rc.scenarioType)}</Chip>
          </span>
          {rc.prerequisiteTags.length === 0 && <Chip tone="ink">前提タグなし</Chip>}
          {rc.prerequisiteTags.map((t) => (
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
                  {c.name}
                  {c.ownerId !== myId ? `（${c.ownerName}から借用）` : ''}
                  {blocked(c) ? '（このシナリオは再挑戦不可）' : ''}
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
            {!characterId && (
              <p className={s.recruitNote}>
                {gmless ? '始められる自分の PC がありません。' : '応募できる PC がありません。'}
              </p>
            )}
            {(apply.error || play.error || scenario.error) && (
              <ErrorNote error={apply.error ?? play.error ?? scenario.error} />
            )}
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
