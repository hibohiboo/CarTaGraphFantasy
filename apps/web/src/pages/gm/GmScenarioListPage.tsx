import { Link } from 'react-router';
import { Chip, ChipGroup, ErrorNote, Loading, PageHeader, Panel } from '../../components';
import { useScenarios } from '../../lib/queries';
import s from '../pages.module.css';

/** GMのシナリオ管理：共有ライブラリから選ぶ（GM＝シナリオを選んで運営する人） */
export function GmScenarioListPage() {
  const scenarios = useScenarios(false);
  if (scenarios.isPending) return <Loading />;
  if (scenarios.error) return <ErrorNote error={scenarios.error} />;

  return (
    <>
      <PageHeader
        title="シナリオを選ぶ"
        crumb="共有ライブラリに公開されているシナリオ。選んでカードを取捨選択し、募集を出す。自分で作るならシナリオ作成者のページへ。"
        actions={<Link to="/creator/scenarios">シナリオを作る →</Link>}
      />
      <div className={s.stack}>
        {scenarios.data.map((sc) => (
          <Panel
            key={sc.id}
            title={<Link to={`/gm/scenarios/${sc.id}`}>{sc.title}</Link>}
            sub={`シナリオ製作者：${sc.authorName} ／ 想定人数 ${sc.partySize.min}〜${sc.partySize.max}人 ／ ${sc.spaceModel ? `${sc.spaceModel === '2d' ? '2次元' : '1次元'}戦闘あり` : '戦闘なし'} ／ 推奨CP ${sc.recommendedCp}枚分`}
          >
            <p className="u-small">{sc.summary}</p>
            <div className="u-mt">
              <ChipGroup>
                {sc.referenceTags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
                {sc.prerequisiteTags.map((t) => (
                  <Chip key={t} tone="off">
                    前提：{t}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
