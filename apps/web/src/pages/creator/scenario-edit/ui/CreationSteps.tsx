import { useId } from 'react';
import s from '@/shared/ui/page.module.css';
import { Button } from '@/shared/ui/ui';
import { type CreationStep, nextStep } from '../lib/steps';

/**
 * 初めて公開するまでの「次にすること」の案内。済みに印を付け、最初の未済みを目立たせる。
 * 公開はいつでも押せる（止めるのは公開の前の確かめの誤りだけ。docs/plans/2026-10-17-シナリオ製作の導線.md D5・D6）
 */
export function CreationSteps({
  steps,
  onOpenDecide,
}: {
  steps: CreationStep[];
  /** 「公開の前に決めること」を開いてそこへ移る（④の段） */
  onOpenDecide: () => void;
}) {
  const headingId = useId();
  const next = nextStep(steps);
  return (
    <section aria-labelledby={headingId} className={s.steps}>
      <h2 id={headingId} className={s.stepsTitle}>
        次にすること
      </h2>
      <ol className={s.stepList}>
        {steps.map((st) => (
          <li
            key={st.id}
            className={s.stepItem}
            data-done={st.done}
            data-next={st === next}
            aria-current={st === next ? 'step' : undefined}
          >
            <span>{st.label}</span>
            {st.done ? <span className="u-small u-dim">済み</span> : null}
            {st === next ? <strong className="u-small">次</strong> : null}
            {st.id === 'decide' && !st.done ? (
              <Button size="sm" variant="ghost" onClick={onOpenDecide}>
                開く
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
