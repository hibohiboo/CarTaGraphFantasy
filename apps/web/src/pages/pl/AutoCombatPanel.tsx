import {
  type AutoCombatState,
  type CardDef,
  type CombatLogEntry,
  HP_CONDITION_LABEL,
  type HpCondition,
  type Session,
} from '@cartagraph/domain';
import { validatePriority } from '@cartagraph/domain/autoCombat';
import { useState } from 'react';
import { Button, ErrorNote, Loading } from '../../components/ui';
import { useCharacter, useRunAutoCombat } from '../../lib/queries';
import s from './AutoCombatPanel.module.css';

// 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）の操作と経過の表示。PlayPage でだけ使う。

/** 戦い方（優先順位リスト）を決めて戦闘を始めるパネル。自動戦闘の設定中だけ手札の代わりに出す */
export function AutoCombatPanel({ session }: { session: Session }) {
  const characterId = session.participants.find((p) => p.role === 'driver')?.characterId ?? '';
  const character = useCharacter(characterId);
  const run = useRunAutoCombat();
  // 優先順位の各行（カードIDと使う条件）
  const [priority, setPriority] = useState<{ id: string; when: HpCondition }[]>([]);

  // 優先順位リストに入れられるカード（自動戦闘の効果と正しいコストを持つもの）だけが候補になる。
  // 基準はサーバーと同じ validatePriority（補助・移動や装備は入れられない）
  const candidates = (character.data?.deck ?? []).filter(
    (card) => validatePriority([{ card, when: 'always' }]) === null,
  );
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const chosen = priority.flatMap((row) => {
    const card = byId.get(row.id);
    return card ? [{ card, when: row.when }] : [];
  });
  const rest = candidates.filter((c) => !priority.some((row) => row.id === c.id));

  if (character.isPending) return <Loading what="手持ちのカードを確認中" />;
  if (character.error) return <ErrorNote error={character.error} />;

  // 表示中の並び（chosen）の添字で入れ替える。デッキから消えたIDは同時に落とす
  const rows = () => chosen.map((e) => ({ id: e.card.id, when: e.when }));
  const move = (index: number, delta: -1 | 1) => {
    const next = rows();
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setPriority(next);
  };
  const setWhen = (index: number, when: HpCondition) =>
    setPriority(rows().map((row, i) => (i === index ? { ...row, when } : row)));
  // 回復を入れたときの初期値は「HPが半分以下」（満タン近くで回復ばかりして攻撃しない罠を避ける）
  const add = (c: CardDef) =>
    setPriority([
      ...rows(),
      { id: c.id, when: c.combatEffect?.type === 'heal' ? 'half' : 'always' },
    ]);

  return (
    <section className={s.panel} aria-labelledby="auto-combat-title">
      <h2 id="auto-combat-title" className={s.title}>
        戦い方を決める
      </h2>
      <p className={s.note}>
        仮ルール：自分の番が来ると、リストの上から「いま使えるカード」が自動で選ばれ、決着まで進む。
        各行の「使う条件」を満たし、残り行動値がコスト以上のカードだけが使える（回復は傷ついているときだけ）。
      </p>
      <div className={s.columns}>
        <div>
          <h3 className={s.subTitle}>優先順位</h3>
          {chosen.length === 0 ? (
            <p className={s.empty}>右の候補からカードを入れよう。</p>
          ) : (
            <ol className={s.list} aria-label="優先順位">
              {chosen.map(({ card: c, when }, i) => (
                <li key={c.id} className={s.item}>
                  <span className={s.cardName}>
                    {c.name}
                    <span className={s.meta}>{effectLabel(c)}</span>
                  </span>
                  <select
                    className={s.when}
                    aria-label={`「${c.name}」を使う条件`}
                    value={when}
                    onChange={(e) => setWhen(i, e.target.value as HpCondition)}
                  >
                    {(Object.keys(HP_CONDITION_LABEL) as HpCondition[]).map((w) => (
                      <option key={w} value={w}>
                        {HP_CONDITION_LABEL[w]}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`「${c.name}」を上へ`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`「${c.name}」を下へ`}
                    disabled={i === chosen.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`「${c.name}」を外す`}
                    onClick={() => setPriority(rows().filter((row) => row.id !== c.id))}
                  >
                    外す
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h3 className={s.subTitle}>候補</h3>
          <ul className={s.list}>
            {rest.map((c) => (
              <li key={c.id} className={s.item}>
                <span className={s.cardName}>
                  {c.name}
                  <span className={s.meta}>{effectLabel(c)}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`「${c.name}」をリストに入れる`}
                  onClick={() => add(c)}
                >
                  入れる
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {run.error && <ErrorNote error={run.error} />}
      <Button
        onClick={() =>
          run.mutate({
            sessionId: session.id,
            priority: chosen.map((e) => ({ cardId: e.card.id, when: e.when })),
          })
        }
        disabled={chosen.length === 0 || run.isPending}
      >
        戦闘を始める
      </Button>
    </section>
  );
}

/** 直前の戦闘の結果と、1手ごとの経過 */
export function AutoCombatLog({
  state,
  plName,
  enemyName,
}: {
  state: AutoCombatState;
  plName: string;
  enemyName: string;
}) {
  const result = state.lastResult;
  if (!result) return null;
  const headline =
    result.outcome === 'win'
      ? `${enemyName}に勝利した`
      : result.outcome === 'lose'
        ? `${enemyName}に敗れた`
        : `決着がつかず、${enemyName}に敗れた`;
  return (
    <div className={s.log}>
      <p className={s.headline}>
        {state.attempts}回目：{result.rounds}ラウンドで{headline}
      </p>
      <ol className={s.logList} aria-label="戦闘の経過">
        {result.log.map((e, i) => (
          // ログは追記のみで並びが変わらないため、添字をキーにしてよい
          // biome-ignore lint/suspicious/noArrayIndexKey: 同上
          <li key={i}>{describe(e, plName, enemyName)}</li>
        ))}
      </ol>
    </div>
  );
}

function effectLabel(c: CardDef) {
  const e = c.combatEffect;
  if (!e) return '';
  const { count, sides, bonus } = e.dice;
  const dice = `${count}d${sides}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ''}`;
  return `コスト${c.actionCost ?? '-'}・${e.type === 'damage' ? '攻撃' : '回復'} ${dice}`;
}

function describe(e: CombatLogEntry, plName: string, enemyName: string) {
  const head = `${e.round}R・カウント${e.count}：`;
  if (e.effect === 'pass')
    return `${head}${e.actorName}は使えるカードが無く、このラウンドの行動を終えた`;
  const hp = e.actor === 'pl' ? e.enemyHp : e.plHp;
  const target = e.actor === 'pl' ? enemyName : plName;
  if (e.effect === 'heal')
    return `${head}${e.actorName}の「${e.cardName}」でHPを${e.amount}回復（HP ${e.actor === 'pl' ? e.plHp : e.enemyHp}）`;
  return `${head}${e.actorName}の「${e.cardName}」（出目 ${e.rolls.join('・')}）→ ${target}に${e.amount}ダメージ（残りHP ${hp}）`;
}
