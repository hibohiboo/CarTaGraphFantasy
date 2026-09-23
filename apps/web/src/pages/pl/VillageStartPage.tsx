import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, ErrorNote, PageHeader } from '../../components/ui';
import { useStartSoloSession } from '../../lib/queries';

// C1（GMレス基盤）の検証用シナリオ（docs/plans/2026-09-23-村スタート冒険者キャンペーン.md）。
// 村パートの内容はC3で決まるため、このシナリオIDは仮のもの。
const SCENARIO_ID = 'sc-village-start';

/**
 * 名前を入力すると、募集・応募を経由せず1リクエストでGMレスのセッションが始まる。
 * C1の動作確認用ページで、C3〜C4で正式な村パートの導入シーンに置き換える。
 */
export function VillageStartPage() {
  const [name, setName] = useState('');
  const start = useStartSoloSession();
  const navigate = useNavigate();

  const submit = () => {
    if (!name.trim() || start.isPending) return;
    start.mutate(
      { scenarioId: SCENARIO_ID, name },
      { onSuccess: (session) => navigate(`/pl/sessions/${session.id}/play`) },
    );
  };

  return (
    <>
      <PageHeader title="（仮）村はずれの一歩" />
      <p>朝もやの中、村はずれの道が街へと続いている。まずは名を聞かせてほしい。</p>
      <div className="u-row u-mt">
        <label htmlFor="village-start-name">名前</label>
        <input
          id="village-start-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button onClick={submit} disabled={start.isPending || !name.trim()}>
          {start.isPending ? '始めている…' : '始める'}
        </Button>
      </div>
      {start.error && <ErrorNote error={start.error} />}
    </>
  );
}
