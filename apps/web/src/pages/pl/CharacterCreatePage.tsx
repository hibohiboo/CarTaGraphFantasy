import type { CardDef } from '@cartagraph/domain';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  CardGrid,
  ErrorNote,
  Field,
  GameCard,
  Loading,
  PageHeader,
  Panel,
} from '../../components';
import { useCardPool, useCreateCharacter } from '../../lib/queries';
import s from '../pages.module.css';

/**
 * キャラクター作成。CP予算はハードな制約（character-growth.md）。
 * 体・技・心の初期配分方法は未決（open-questions.md「次に詰める候補」）のため、
 * ここでは仮に「合計9を1〜5で自由に配分」としている。
 */
const ABILITY_TOTAL = 9;

export function CharacterCreatePage() {
  const pool = useCardPool();
  const create = useCreateCharacter();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [hasAbilities, setHasAbilities] = useState(true);
  const [ab, setAb] = useState({ body: 3, skill: 3, mind: 3 });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allCards = useMemo(
    () => [...(pool.data?.basic ?? []), ...(pool.data?.unlocked ?? [])],
    [pool.data],
  );
  const spent = allCards
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + (c.cpCost ?? 0), 0);
  const budget = pool.data?.budget ?? 0;
  const over = spent > budget;
  const abilitySum = ab.body + ab.skill + ab.mind;

  if (pool.isPending) return <Loading />;
  if (pool.error) return <ErrorNote error={pool.error} />;

  const toggle = (c: CardDef) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      return next;
    });

  const submit = () =>
    create.mutate(
      { name, abilities: hasAbilities ? ab : undefined, cardIds: [...selected] },
      { onSuccess: (ch) => navigate(`/pl/characters/${ch.id}`) },
    );

  return (
    <>
      <PageHeader
        title="キャラクター作成"
        crumb="基本カードプール＋自分が解放したプールから、CP予算の範囲でカードを選ぶ。予算超過は機械的に禁止される（ソフトガイドではない数少ない制約）。"
      />
      <div className={s.twoCol}>
        <aside className="u-stack">
          <Panel title="基本情報">
            <div className={s.form}>
              <Field label="名前">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例：迅"
                />
              </Field>
              <label className="u-row u-small">
                <input
                  type="checkbox"
                  checked={hasAbilities}
                  onChange={(e) => setHasAbilities(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                能力値（体・技・心）を持つ ＝ 探索者として始める
              </label>
              {hasAbilities && (
                <>
                  <div className={s.abilityInputs}>
                    {(['body', 'skill', 'mind'] as const).map((k) => (
                      <Field key={k} label={{ body: '体', skill: '技', mind: '心' }[k]}>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={ab[k]}
                          onChange={(e) => setAb({ ...ab, [k]: Number(e.target.value) })}
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="u-small u-dim">
                    合計 {abilitySum} / {ABILITY_TOTAL}（配分方法は未決の仮ルール）
                  </p>
                </>
              )}
            </div>
          </Panel>
          <Panel title="CP予算">
            <p className={s.budget} data-over={over ? 'true' : undefined}>
              {spent} / {budget}
            </p>
            <p className="u-small u-dim">選んだカードのCPコスト合計。超えると作成できない。</p>
            <div className="u-mt">
              <Button
                block
                onClick={submit}
                disabled={
                  create.isPending ||
                  over ||
                  !name.trim() ||
                  (hasAbilities && abilitySum !== ABILITY_TOTAL)
                }
              >
                {create.isPending ? '作成中…' : 'このPCを作成する'}
              </Button>
              {create.error && (
                <div className="u-mt">
                  <ErrorNote error={create.error} />
                </div>
              )}
            </div>
          </Panel>
        </aside>
        <div className="u-stack">
          <Panel title="基本カードプール" sub="誰でも最初から選べるシステム標準のカード。">
            <CardGrid min={130}>
              {pool.data.basic.map((c) => (
                <GameCard
                  key={c.id}
                  card={c}
                  fluid
                  portrait
                  showDescription
                  showCost="cp"
                  selected={selected.has(c.id)}
                  onClick={() => toggle(c)}
                />
              ))}
            </CardGrid>
          </Panel>
          <Panel
            title="解放済みカードプール"
            sub="過去のPCが獲得したカード。無償配布ではなく、CPを払えば選べる選択肢が広がっている。"
          >
            <CardGrid min={130}>
              {pool.data.unlocked.map((c) => (
                <GameCard
                  key={c.id}
                  card={c}
                  fluid
                  portrait
                  showDescription
                  showCost="cp"
                  selected={selected.has(c.id)}
                  onClick={() => toggle(c)}
                />
              ))}
            </CardGrid>
          </Panel>
        </div>
      </div>
    </>
  );
}
