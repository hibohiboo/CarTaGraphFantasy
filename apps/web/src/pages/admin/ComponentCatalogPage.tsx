import { CARD_KIND_LABEL, type CardKind } from '@cartagraph/domain';
import type { ReactNode } from 'react';
import { DeckTree } from '../../components/DeckTree';
import { CardGrid, GameCard } from '../../components/GameCard';
import {
  Avatar,
  Button,
  Chip,
  ChipGroup,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  Pips,
  RoleBadge,
  StatGrid,
  StatTile,
  StatusPill,
  ZonePill,
} from '../../components/ui';
import s from '../pages.module.css';

const tokens = [
  ['--felt', '卓上フェルト地（背景）'],
  ['--felt-panel', 'パネル背景'],
  ['--felt-panel-2', 'さらに暗いパネル／伏せ札の地'],
  ['--card', 'カード地（生成り紙）'],
  ['--ink', 'カード上の文字'],
  ['--ink-soft', 'カード上の副次テキスト'],
  ['--parchment-text', '卓上の文字'],
  ['--parchment-text-dim', '卓上の副次テキスト'],
  ['--seal', '朱印・GM系の強調色'],
  ['--thread', '金糸＝エッジ・装飾線'],
  ['--focus', 'フォーカスリング・強調枠'],
  ['--pending', '承認待ち'],
  ['--approved', '採用'],
  ['--rejected', '却下'],
  ['--neutral', '中立'],
];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Panel title={title} sub={note}>
      <div className={s.catalogRow}>{children}</div>
    </Panel>
  );
}

/** 共通UI部品の一覧。新しい部品を足したらここにも並べる */
export function ComponentCatalogPage() {
  return (
    <>
      <PageHeader
        title="コンポーネントカタログ"
        crumb="共通UI部品とデザイントークン。試作フェーズ（docs/architecture/prototype-handover.md）で決めた見た目を React に移植したもの。"
      />
      <div className={s.catalog}>
        <Section title="デザイントークン" note="CSS変数。src/styles/tokens.css">
          {tokens.map(([name, desc]) => (
            <div key={name} className="u-row u-small" style={{ width: 240 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: `var(${name})`,
                  border: '1px solid var(--thread-dim)',
                  flex: 'none',
                }}
              />
              <span>
                <code>{name}</code>
                <br />
                <span className="u-dim">{desc}</span>
              </span>
            </div>
          ))}
        </Section>

        <Section
          title="タイポグラフィ"
          note="見出し・カード名は Zen Old Mincho、本文・UIは Zen Kaku Gothic New"
        >
          <div>
            <p className="u-serif" style={{ fontSize: '1.6rem', fontWeight: 600 }}>
              見出し（明朝）
            </p>
            <p>本文はゴシック。行間 1.75。</p>
            <p className="u-dim u-small">副次テキスト</p>
          </div>
        </Section>

        <Section
          title="GameCard"
          note="5:7比率。単一のゲーム内カードはすべてこれ。variant / faceDown / portrait / stamp / cost / selected"
        >
          <GameCard
            card={{ kind: 'choice', name: '開ける' }}
            width={110}
            centerName
            onClick={() => {}}
          />
          <GameCard
            card={{ kind: 'choice', name: '調べる' }}
            width={110}
            centerName
            selected
            onClick={() => {}}
          />
          <GameCard
            card={{ kind: 'choice', name: '＋\n新たな選択肢を提案' }}
            width={110}
            centerName
            variant="propose"
            onClick={() => {}}
          />
          <GameCard card={{ kind: 'info', name: '何かが書かれた紙', faceDown: true }} width={110} />
          <GameCard
            card={{ kind: 'character', name: '迅', description: '探索者' }}
            width={130}
            portrait
            showDescription
          />
          <GameCard
            card={{
              kind: 'skill',
              name: '斬撃',
              description: '射程1。ダイスでダメージを決める',
              tags: ['戦闘スキル'],
              actionCost: 3,
              range: 1,
            }}
            width={130}
            showDescription
            showTags
            showCost="action"
          />
          <GameCard
            card={{
              kind: 'item',
              name: '灯火のランタン',
              description: '暗い場所を照らす',
              cpCost: 1,
            }}
            width={130}
            showDescription
            showCost="cp"
          />
          <GameCard
            card={{ kind: 'relation', name: '幼馴染', description: '物語上意味を持つ関係性' }}
            width={130}
            showDescription
            stamp="決"
          />
          <GameCard card={{ kind: 'npc', name: '館の老従者', zone: 'gm' }} width={110} showZone />
        </Section>

        <Section title="カード種別ラベル" note="CARD_KIND_LABEL（packages/domain）">
          {(Object.keys(CARD_KIND_LABEL) as CardKind[]).map((k) => (
            <Chip key={k} tone="off">
              {k} → {CARD_KIND_LABEL[k]}
            </Chip>
          ))}
        </Section>

        <Section title="CardGrid" note="5:7のまま自動折り返し。min で最小幅を指定">
          <div style={{ width: '100%' }}>
            <CardGrid min={110}>
              {['開ける', '調べる', '戻る', '扉を破壊する', '耳を澄ます'].map((n) => (
                <GameCard key={n} card={{ kind: 'choice', name: n }} fluid centerName />
              ))}
            </CardGrid>
          </div>
        </Section>

        <Section
          title="RoleBadge"
          note="役割は色で統一：ドライバー＝金／ナビゲーター＝スレート／GM＝朱"
        >
          <RoleBadge badgeRole="driver">迅（ドライバー）</RoleBadge>
          <RoleBadge badgeRole="navigator">カヤ（ナビゲーター）</RoleBadge>
          <RoleBadge badgeRole="gm">霧乃（GM）</RoleBadge>
          <RoleBadge badgeRole="creator">シナリオ製作者</RoleBadge>
          <RoleBadge badgeRole="mode">軽量モード</RoleBadge>
          <RoleBadge badgeRole="library">共有ライブラリ公開中</RoleBadge>
        </Section>

        <Section title="StatusPill" note="状態セマンティック色。アクセントの金とは役割を分離">
          <StatusPill status="pending">承認待ち</StatusPill>
          <StatusPill status="approved">採用済み</StatusPill>
          <StatusPill status="approved-unused">採用済み・今回は未使用</StatusPill>
          <StatusPill status="rejected">却下</StatusPill>
          <StatusPill status="neutral">中立</StatusPill>
          <StatusPill status="good">参加できます</StatusPill>
          <StatusPill status="warn">要注意</StatusPill>
        </Section>

        <Section title="Chip / ZonePill / Avatar">
          <ChipGroup>
            <Chip>体・技・心を参照</Chip>
            <Chip tone="off">戦闘スキルは未使用</Chip>
            <Chip tone="ink">カード上のチップ</Chip>
          </ChipGroup>
          <ZonePill zone="gm" />
          <ZonePill zone="pl" />
          <Avatar name="迅" avatarRole="driver" />
          <Avatar name="カヤ" avatarRole="navigator" />
          <Avatar name="霧乃" avatarRole="gm" />
        </Section>

        <Section title="Button">
          <Button>primary</Button>
          <Button variant="ink">ink（カード上）</Button>
          <Button variant="approve">approve</Button>
          <Button variant="danger">danger</Button>
          <Button variant="ghost">ghost</Button>
          <Button variant="link">link</Button>
          <Button size="sm">sm</Button>
          <Button disabled>disabled</Button>
        </Section>

        <Section title="StatTile">
          <div style={{ width: '100%' }}>
            <StatGrid>
              <StatTile value="3-2 / 7" label="進行中のシーン" />
              <StatTile value={1} label="承認待ち" tone="pending" />
              <StatTile value={1} label="採用済み" tone="approved" />
              <StatTile value={1} label="却下" tone="rejected" />
            </StatGrid>
          </div>
        </Section>

        <Section title="Pips（能力値）">
          <div>
            <div className={s.abilityRow}>
              <span>体</span>
              <Pips value={3} label="体" />
            </div>
            <div className={s.abilityRow}>
              <span>技</span>
              <Pips value={4} label="技" />
            </div>
            <div className={s.abilityRow}>
              <span>心</span>
              <Pips value={2} label="心" />
            </div>
          </div>
        </Section>

        <Section title="DeckTree" note="シナリオデッキの入れ子構造">
          <div style={{ width: '100%' }}>
            <DeckTree
              currentId="s2"
              excludedIds={new Set(['s3'])}
              nodes={[
                { id: 'i', kind: 'intro', name: '灰色館へ到着', cards: [] },
                {
                  id: 's1',
                  kind: 'scene',
                  name: '3-1 地下回廊',
                  cards: [{ id: 'a', kind: 'location', name: 'x', tags: [] }],
                },
                { id: 's2', kind: 'scene', name: '3-2 奥の扉', cards: [] },
                { id: 's3', kind: 'scene', name: '3-3 甲板の戦い', dense: true, cards: [] },
                { id: 'e', kind: 'ending', name: '結末', cards: [] },
              ]}
            />
          </div>
        </Section>

        <Section title="状態表示" note="Loading / ErrorNote / EmptyNote">
          <div style={{ width: '100%' }}>
            <Loading />
            <ErrorNote error={new Error('CP予算（5）を超えています')} />
            <EmptyNote>まだありません。</EmptyNote>
          </div>
        </Section>

        <Section title="フォーム部品" note="global.css の input / select / textarea">
          <div className={s.form} style={{ width: '100%', maxWidth: 400 }}>
            <input type="text" placeholder="テキスト" />
            <select>
              <option>選択肢</option>
            </select>
            <textarea placeholder="複数行" />
          </div>
        </Section>
      </div>
    </>
  );
}
