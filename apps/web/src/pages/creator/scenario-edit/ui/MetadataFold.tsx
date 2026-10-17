import {
  SCENARIO_TYPE_FLAG_LABEL,
  type Scenario,
  type ScenarioType,
} from '@cartagraph/domain/scenario/model';
import { scenarioTypeLabel } from '@cartagraph/domain/scenario/type';
import type { Ref } from 'react';
import s from '@/shared/ui/page.module.css';
import { Field } from '@/shared/ui/ui';
import { scenarioSummaryLine } from '../lib/summary';

const SCENARIO_TYPE_FLAGS = ['noCombat', 'noCheck'] as const;

/**
 * 公開の前に決めること（概要・シナリオタイプ・想定人数など）。畳んで、今の値を1行の要約で見せる
 * （docs/plans/2026-10-17-シナリオ製作の導線.md D1・D7・D8）。開閉は呼び出し側が持つ（保存で作り直されても開いたままにするため）
 */
export function MetadataFold({
  draft,
  open,
  onToggle,
  foldRef,
  set,
  toggleType,
}: {
  draft: Scenario;
  open: boolean;
  onToggle: (open: boolean) => void;
  foldRef: Ref<HTMLDetailsElement>;
  set: <K extends keyof Scenario>(k: K, v: Scenario[K]) => void;
  toggleType: (flag: keyof ScenarioType) => void;
}) {
  return (
    <details
      ref={foldRef}
      className={s.foldPanel}
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary className={s.foldSummary}>
        <h2 className="u-inline" style={{ display: 'inline', fontSize: '1rem' }}>
          公開の前に決めること
        </h2>
        <span className={s.foldLine}>{scenarioSummaryLine(draft)}</span>
      </summary>
      <div className={s.foldBody}>
        <p className="u-small u-dim">
          GMがシナリオを選ぶ際の判断材料。前提タグを満たさなくても応募自体は止めない。
        </p>
        <div className={s.form}>
          <Field label="概要">
            <textarea value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
          </Field>
          <div>
            <div className={s.metaLabel}>
              使わない仕組み（シナリオタイプ：
              <span data-testid="scenario-type">{scenarioTypeLabel(draft.scenarioType)}</span>）
            </div>
            {SCENARIO_TYPE_FLAGS.map((flag) => (
              <label key={flag} className="u-row u-small" style={{ marginTop: 4 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={draft.scenarioType[flag]}
                  onChange={() => toggleType(flag)}
                />
                {SCENARIO_TYPE_FLAG_LABEL[flag]}
              </label>
            ))}
          </div>
          <Field label="前提タグ（カンマ区切り。前作の結末タグも同じ仕組み）">
            <input
              type="text"
              value={draft.prerequisiteTags.join(', ')}
              onChange={(e) =>
                set(
                  'prerequisiteTags',
                  e.target.value
                    .split(/[,、]/)
                    .map((x) => x.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>
          <div className={s.formRow}>
            <Field label="想定人数（最小）">
              <input
                type="number"
                min={1}
                value={draft.partySize.min}
                onChange={(e) =>
                  set('partySize', { ...draft.partySize, min: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="想定人数（最大）">
              <input
                type="number"
                min={1}
                value={draft.partySize.max}
                onChange={(e) =>
                  set('partySize', { ...draft.partySize, max: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="空間モデル（戦闘がある場合）">
            <select
              value={draft.spaceModel ?? ''}
              // 戦闘なしなら選べない。読み込んだ時点で空間モデルを持っていたら、外せるように選べるままにする
              disabled={draft.scenarioType.noCombat && draft.spaceModel === null}
              onChange={(e) =>
                set('spaceModel', (e.target.value || null) as Scenario['spaceModel'])
              }
            >
              <option value="">空間なし</option>
              <option value="1d">1次元（敵後衛／敵前衛／味方前衛／味方後衛）</option>
              <option value="2d">2次元（1マス1キャラクター）</option>
            </select>
          </Field>
          <div className={s.formRow}>
            <Field label="推奨CP（ソフトガイド）">
              <input
                type="number"
                min={0}
                value={draft.recommendedCp}
                onChange={(e) => set('recommendedCp', Number(e.target.value))}
              />
            </Field>
            <Field label="クリア時の基本CP">
              <input
                type="number"
                min={0}
                value={draft.baseCp}
                onChange={(e) => set('baseCp', Number(e.target.value))}
              />
            </Field>
          </div>
        </div>
      </div>
    </details>
  );
}
