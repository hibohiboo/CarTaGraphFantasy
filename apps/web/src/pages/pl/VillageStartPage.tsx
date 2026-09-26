import { useNavigate } from 'react-router';
import { NameProposal } from '../../components/NameProposal';
import { Table } from '../../components/play';
import { ErrorNote, PageHeader, Panel } from '../../components/ui';
import { useStartSoloSession } from '../../lib/queries';
import s from '../pages.module.css';

// 村スタート冒険者キャンペーンの検証用シナリオ（docs/plans/2026-09-23-村スタート冒険者キャンペーン.md）。
// 村パートの内容はC3で決まるため、このシナリオIDは仮のもの。
const SCENARIO_ID = 'sc-village-start';

/**
 * GMの情景描写の後、「＋名を名乗る」の提案カードで名乗ると、募集・応募を経由せず
 * 1リクエストでGMレスのセッションが始まる（旅立ちの酒場と同じ名乗りの流れ。
 * docs/plans/2026-09-23-自動戦闘エンジン.md 決定事項22）。C3〜C4で正式な村パートの導入に置き換える。
 */
export function VillageStartPage() {
  const start = useStartSoloSession();
  const navigate = useNavigate();

  const introduce = (name: string) => {
    if (start.isPending) return;
    start.mutate(
      { scenarioId: SCENARIO_ID, name },
      { onSuccess: (session) => navigate(`/pl/sessions/${session.id}/play`) },
    );
  };

  return (
    <>
      <PageHeader title="（仮）村はずれの一歩" />
      <Panel>
        <Table
          speaker="GM"
          flavor="朝もやの中、村はずれの道が街へと続いている。まずは名を聞かせてほしい。"
        />
        <div className={s.form}>
          <NameProposal busy={start.isPending} onSubmit={introduce} />
          {start.error && <ErrorNote error={start.error} />}
        </div>
      </Panel>
    </>
  );
}
