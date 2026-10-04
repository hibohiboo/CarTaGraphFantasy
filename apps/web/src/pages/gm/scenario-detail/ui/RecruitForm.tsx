import { deadEndNodes, hasAutoCombat } from '@cartagraph/domain/scenario/deadEnd';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import { sessionDeck } from '@cartagraph/domain/session/deck';
import type { Recruitment } from '@cartagraph/domain/session/model';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateRecruitment } from '@/entities/session/api/mutations';
import s from '@/shared/ui/page.module.css';
import { Button, ErrorNote, Field, Panel } from '@/shared/ui/ui';

/**
 * 募集を出す（docs/cartagraph/scenario-flow.md「募集とセッション」）。通常の募集（応募を受けて GM が始める）か、
 * GM 不在の募集（PL が自分の PC ですぐ始める）かを選ぶ。どちらも、GM の判断のための注意を出すだけで止めない
 */
export function RecruitForm({ scenario, excluded }: { scenario: Scenario; excluded: Set<string> }) {
  const recruit = useCreateRecruitment();
  const navigate = useNavigate();
  const [kind, setKind] = useState<Recruitment['kind']>('normal');
  const [capacity, setCapacity] = useState(3);
  const [note, setNote] = useState('');
  // シナリオが提案不可なら、GM 不在の募集でも提案不可に固定する（play-and-field.md「GMレスセッションでの提案の扱い」）
  const fixedDisabled = scenario.proposalHandling === 'disabled';
  const [proposalHandling, setProposalHandling] = useState<
    NonNullable<Recruitment['proposalHandling']>
  >(fixedDisabled ? 'disabled' : 'gm-required');

  const deck = sessionDeck(scenario.deck, [...excluded]);
  const deadEnds = kind === 'gmless' ? deadEndNodes(deck) : [];
  const autoCombatWarning = kind === 'normal' && hasAutoCombat(deck);

  const submit = () =>
    recruit.mutate(
      {
        scenarioId: scenario.id,
        kind,
        ...(kind === 'normal' ? { capacity } : { proposalHandling }),
        note: note || undefined,
        excludedNodeIds: [...excluded],
      },
      { onSuccess: () => navigate('/gm/sessions') },
    );

  return (
    <Panel title="募集を出す" sub="想定人数・前提タグ・空間モデルは自動で明示される。">
      <div className={s.form}>
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className={s.metaLabel}>募集の種類</legend>
          {(
            [
              ['normal', '通常（応募を受けて GM が始める）'],
              ['gmless', 'GM 不在（PL が自由に始める）'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ display: 'block' }}>
              <input
                type="radio"
                name="recruit-kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />{' '}
              {label}
            </label>
          ))}
        </fieldset>
        {kind === 'normal' ? (
          <Field label="募集人数（ドライバー候補＋PC）">
            <input
              type="number"
              min={1}
              max={scenario.partySize.max}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </Field>
        ) : (
          <Field label="提案の扱い">
            <select
              value={proposalHandling}
              disabled={fixedDisabled}
              onChange={(e) =>
                setProposalHandling(e.target.value as NonNullable<Recruitment['proposalHandling']>)
              }
            >
              <option value="gm-required">GM が後から裁定（提案するとセッションは中断）</option>
              <option value="disabled">提案不可</option>
            </select>
          </Field>
        )}
        {kind === 'gmless' && (
          <p className="u-small u-dim">
            PL が自分の PC を選んで、すぐに始める。始めるたびに、その PL だけのセッションができる。
            進行はシステムが受け持ち、GM は提案の裁定だけを行う。
          </p>
        )}
        {deadEnds.length > 0 && (
          <div className="u-small">
            <p>先へ進む選択肢の無いシーンがあります：{deadEnds.map((n) => n.name).join('、')}</p>
            <p>
              {proposalHandling === 'disabled'
                ? '提案不可なので、行き止まりから抜けられません。'
                : '提案を GM が移り先付きで採用すると抜けられます。'}
            </p>
          </div>
        )}
        {autoCombatWarning && (
          <p className="u-small">
            自動戦闘のシーンがあります。通常の募集では、自動戦闘のシーンへ進めません（自動戦闘は GM
            不在のセッションだけ）。
          </p>
        )}
        <Field label="募集メモ（任意）">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：初心者歓迎。前提を満たさなくても相談を"
          />
        </Field>
        <Button block disabled={recruit.isPending} onClick={submit}>
          {recruit.isPending ? '募集を作成中…' : `この構成で募集を出す（${excluded.size}件を外す）`}
        </Button>
        {recruit.error && <ErrorNote error={recruit.error} />}
      </div>
    </Panel>
  );
}
