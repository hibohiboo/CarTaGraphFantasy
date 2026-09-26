import { useNavigate } from 'react-router';
import { NameProposal } from '../../components/NameProposal';
import { Table } from '../../components/play';
import { ErrorNote, Loading, PageHeader, Panel } from '../../components/ui';
import { useScenario, useStartSoloSession } from '../../lib/queries';
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
  const scenario = useScenario(SCENARIO_ID);
  const start = useStartSoloSession();
  const navigate = useNavigate();

  const introduce = (name: string) => {
    if (start.isPending) return;
    start.mutate(
      { scenarioId: SCENARIO_ID, name },
      { onSuccess: (session) => navigate(`/pl/sessions/${session.id}/play`) },
    );
  };

  if (scenario.isPending) return <Loading />;
  if (scenario.error) return <ErrorNote error={scenario.error} />;

  return (
    <>
      <PageHeader title={scenario.data.title} />
      <Panel>
        {/* 導入の情景描写はシナリオの概要（summary）から引き、名乗りを促す一言を添える */}
        <Table speaker="GM" flavor={`${scenario.data.summary}まずは名を聞かせてほしい。`} />
        <div className={s.form}>
          <NameProposal busy={start.isPending} error={start.error} onSubmit={introduce} />
        </div>
      </Panel>
    </>
  );
}
