import { sessionDeck } from '@cartagraph/domain/session/deck';
import type { Session } from '@cartagraph/domain/session/model';
import {
  checkNarration,
  type DealtChoice,
  isAtEnding,
  narrationTargets,
} from '@cartagraph/domain/session/narrate';
import { useRef, useState } from 'react';
import { useScenario } from '@/entities/scenario/api/queries';
import { useNarrate } from '@/entities/session/api/mutations';
import s from '@/shared/ui/page.module.css';
import { Button, ErrorNote, Field, Panel } from '@/shared/ui/ui';

/** 配る選択肢の入力の行。key は行を足したときに振る（途中の行を消しても入力がずれないように） */
type ChoiceRow = DealtChoice & { key: number };

/**
 * 人間GMの進行：描写を書く・選択肢カードをその場で作って配る・取り下げる、を1回で送る
 * （docs/cartagraph/play-and-field.md「選択肢カードとGMの生成」「次のシーンへ進む」）。
 * 検査・移り先の一覧・結末の判定は packages/domain の session/narrate.ts
 */
export function NarrationPanel({ session }: { session: Session }) {
  const scenario = useScenario(session.scenarioId);
  const narrate = useNarrate();
  const [flavor, setFlavor] = useState('');
  const [withdraw, setWithdraw] = useState<string[]>([]);
  const [rows, setRows] = useState<ChoiceRow[]>([]);
  const nextKey = useRef(0);

  const deck = scenario.data ? sessionDeck(scenario.data.deck, session.excludedNodeIds ?? []) : [];
  const targets = narrationTargets(deck, session.currentScene.nodeId);
  const handChoices = session.hand.filter((c) => c.kind === 'choice');
  const input = {
    flavor,
    withdrawCardIds: withdraw,
    choices: rows.map(({ key: _, ...c }) => c),
  };
  const check = checkNarration(session, deck, input);
  const untouched = !flavor.trim() && withdraw.length === 0 && rows.length === 0;
  const atEnding = isAtEnding(deck, session.currentScene.nodeId);

  const updateRow = (key: number, patch: Partial<DealtChoice>) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const toggleWithdraw = (id: string) =>
    setWithdraw(withdraw.includes(id) ? withdraw.filter((x) => x !== id) : [...withdraw, id]);
  const submit = () =>
    narrate.mutate(
      { sessionId: session.id, ...input },
      {
        onSuccess: () => {
          setFlavor('');
          setWithdraw([]);
          setRows([]);
        },
      },
    );

  return (
    <Panel
      title="描写と選択肢を配る"
      sub="ドライバーの選んだ結果を描写し、次の選択肢を配る。移り先を指定した選択肢をドライバーがプレイすると、そのシーンへ進む。"
    >
      {scenario.error && <ErrorNote error={scenario.error} />}
      {atEnding && (
        <p className="u-mt">
          結末「{session.currentScene.name}」に着いた。結末の描写を書いて、セッションを終了できる。
        </p>
      )}
      <div className={s.form}>
        <div>
          <div className={s.metaLabel}>いまの描写</div>
          <p>{session.flavor}</p>
        </div>
        <Field label="描写">
          <textarea
            rows={3}
            value={flavor}
            onChange={(e) => setFlavor(e.target.value)}
            placeholder="空欄なら、いまの描写のまま"
          />
        </Field>

        <div>
          <div className={s.metaLabel}>手札の選択肢（{handChoices.length}枚）</div>
          {handChoices.length === 0 ? (
            <p className="u-small u-dim">手札に選択肢はない。</p>
          ) : (
            <ul className="u-mt" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {handChoices.map((c) => (
                <li key={c.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={withdraw.includes(c.id)}
                      onChange={() => toggleWithdraw(c.id)}
                      aria-label={`「${c.name}」を取り下げる`}
                    />{' '}
                    {c.name}
                    {c.nextNodeId && (
                      <span className="u-small u-dim">
                        （→
                        {targets.find((t) => t.id === c.nextNodeId)?.label ?? c.nextNodeId}）
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {rows.map((r, i) => (
          <fieldset key={r.key} className={s.form} style={{ margin: 0 }}>
            <legend>配る選択肢{i + 1}</legend>
            <Field label={`選択肢${i + 1}の名前`}>
              <input
                type="text"
                value={r.name}
                onChange={(e) => updateRow(r.key, { name: e.target.value })}
                placeholder="例：扉を破壊する"
              />
            </Field>
            <Field label={`選択肢${i + 1}の説明文`}>
              <input
                type="text"
                value={r.description ?? ''}
                onChange={(e) => updateRow(r.key, { description: e.target.value })}
                placeholder="任意"
              />
            </Field>
            <Field label={`選択肢${i + 1}の移り先`}>
              <select
                value={r.nextNodeId ?? ''}
                onChange={(e) => updateRow(r.key, { nextNodeId: e.target.value })}
              >
                <option value="">このシーンに留まる（移り先なし）</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
              >
                選択肢{i + 1}を消す
              </Button>
            </div>
          </fieldset>
        ))}

        <div className="u-row">
          <Button
            variant="ghost"
            onClick={() => setRows([...rows, { key: nextKey.current++, name: '', nextNodeId: '' }])}
          >
            選択肢を足す
          </Button>
          <Button disabled={!scenario.data || !check.ok || narrate.isPending} onClick={submit}>
            送る
          </Button>
        </div>
        {!check.ok && !untouched && <p className="u-small">{check.error}</p>}
        {narrate.error && <ErrorNote error={narrate.error} />}
      </div>
    </Panel>
  );
}
