import type { Recruitment } from '@cartagraph/domain/session/model';
import s from '@/shared/ui/page.module.css';
import { StatusPill } from '@/shared/ui/ui';

/**
 * 「自分の募集」の GM 不在の募集（docs/cartagraph/scenario-flow.md「募集とセッション」）。応募は無く、PL が自分の PC で
 * 自由に始めるので、開始のフォームの代わりに、始まったセッションの件数を出す
 */
export function GmlessRecruitmentCard({
  rc,
  startedCount,
}: {
  rc: Recruitment;
  startedCount: number;
}) {
  return (
    <article className={s.recruit}>
      <h3 className={s.recruitTitle}>{rc.scenarioTitle}</h3>
      {rc.note && <p className={s.recruitSub}>{rc.note}</p>}
      <StatusPill status="neutral">GM 不在</StatusPill>
      <hr className={s.recruitDivider} />
      <p className={s.recruitNote}>
        PL が自由に始める。始まったセッション {startedCount} 件。提案の扱い：
        {rc.proposalHandling === 'disabled' ? '提案不可' : 'GM が後から裁定'}
      </p>
    </article>
  );
}
