import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useScenario } from '@/entities/scenario/api/queries';
import { DeckTree } from '@/entities/scenario/ui/DeckTree';
import s from '@/shared/ui/page.module.css';
import {
  Button,
  Chip,
  ChipGroup,
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  RoleBadge,
} from '@/shared/ui/ui';
import { RecruitForm } from './RecruitForm';

/**
 * GMのカスタマイズ＝シナリオデッキの中から今回使うカード・シーンを選ぶ／外す（scenario-flow.md）。
 * 難易度調整や設定差し替えも裁量で許容されるが、この画面ではまず取捨選択だけを扱う。
 */
export function GmScenarioDetailPage() {
  const { scenarioId = '' } = useParams();
  const scenario = useScenario(scenarioId);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  if (scenario.isPending) return <Loading />;
  if (scenario.error) return <ErrorNote error={scenario.error} />;
  const sc = scenario.data;

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader
        title={sc.title}
        crumb={
          <>
            シナリオ製作者：{sc.authorName} ／ <Link to="/gm/scenarios">シナリオ一覧へ戻る</Link>
          </>
        }
        actions={<RoleBadge badgeRole="gm">GMとしてカスタマイズ中</RoleBadge>}
      />
      <div className={s.twoCol}>
        <aside className="u-stack">
          <Panel
            title="メタデータ"
            sub="募集を出すときPLに明示される。前提タグはソフトガイドで、満たさない応募も止めない。"
          >
            <div className={s.metaRow}>
              <div className={s.metaLabel}>参照するデータ種別</div>
              <ChipGroup>
                {sc.referenceTags.length === 0 && <Chip tone="off">なし（旅人向け）</Chip>}
                {sc.referenceTags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </ChipGroup>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>前提タグ</div>
              <ChipGroup>
                {sc.prerequisiteTags.length === 0 && <Chip tone="off">なし（誰でも応募可）</Chip>}
                {sc.prerequisiteTags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </ChipGroup>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>想定人数</div>
              <div className={s.metaValue}>
                {sc.partySize.min}〜{sc.partySize.max}人（ドライバー1人）
              </div>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>空間モデル</div>
              <div className={s.metaValue}>
                {sc.spaceModel === '2d' ? '2次元' : sc.spaceModel === '1d' ? '1次元' : '戦闘なし'}
              </div>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>推奨CP／基本CP</div>
              <div className={s.metaValue}>
                {sc.recommendedCp}枚分／クリア時 {sc.baseCp}
              </div>
            </div>
          </Panel>
          <RecruitForm scenario={sc} excluded={excluded} />
        </aside>
        <div className="u-stack">
          <Panel
            title="シナリオデッキの取捨選択"
            sub="今回使うシーン・カードを選ぶ／外す。外したシーンはセッションに含めない（導入と結末は外せない）。"
          >
            <DeckTree
              nodes={sc.deck}
              excludedIds={excluded}
              renderActions={(n) =>
                n.kind === 'intro' || n.kind === 'ending' ? null : (
                  <Button size="sm" variant="ghost" onClick={() => toggle(n.id)}>
                    {excluded.has(n.id) ? '戻す' : '外す'}
                  </Button>
                )
              }
            />
          </Panel>
          <Panel
            title="結末タグ"
            sub="このシナリオが配り得る結末。後続シナリオの前提タグと同じ仕組みで突き合わされる。"
          >
            <div className={s.list}>
              {sc.endings.map((e) => (
                <div key={e.id} className={s.listItem}>
                  <span>{e.name}</span>
                  <span className={s.itemSub}>
                    {e.grantsTag
                      ? `→ 前提タグ「${e.grantsTag}」`
                      : '→ 前提タグなし（単発として扱う）'}
                    {e.noReplay && '（再挑戦不可：この結末に至った PC はもう一度遊べない）'}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
