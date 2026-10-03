import type { Recruitment } from '@cartagraph/domain/session/model';
import { checkStart, defaultPartyName } from '@cartagraph/domain/session/start';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStartSession } from '@/entities/session/api/mutations';
import s from '@/shared/ui/page.module.css';
import { Button, EmptyNote, ErrorNote, Field } from '@/shared/ui/ui';
import local from './StartFromRecruitment.module.css';

/**
 * 自分の募集から、参加させる PC とドライバーの PC を選んでセッションを始める
 * （docs/cartagraph/scenario-flow.md「セッション開始までの全体フロー」5）。
 * 始められるか・想定人数の注意・パーティー名の初期値は packages/domain の checkStart・defaultPartyName に任せる
 */
export function StartFromRecruitment({ rc }: { rc: Recruitment }) {
  const start = useStartSession();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [driver, setDriver] = useState('');
  const [partyName, setPartyName] = useState('');

  const toggle = (characterId: string) => {
    if (selected.includes(characterId)) {
      setSelected(selected.filter((id) => id !== characterId));
      if (driver === characterId) setDriver('');
    } else {
      setSelected([...selected, characterId]);
    }
  };
  // 画面の選択順ではなく応募の順で送る（参加者の行の並びを応募順に揃える）
  const characterIds = rc.applicants
    .map((a) => a.characterId)
    .filter((id) => selected.includes(id));
  const check = checkStart(rc, { characterIds, driverCharacterId: driver });
  const driverName = rc.applicants.find((a) => a.characterId === driver)?.characterName;

  return (
    <article className={s.recruit}>
      <h3 className={s.recruitTitle}>{rc.scenarioTitle}</h3>
      {rc.note && <p className={s.recruitSub}>{rc.note}</p>}
      <p className={s.recruitSub}>
        想定人数 {rc.partySize.min}〜{rc.partySize.max}人（応募 {rc.applicants.length}/{rc.capacity}
        ）
      </p>
      <hr className={s.recruitDivider} />
      {rc.applicants.length === 0 ? (
        <EmptyNote>まだ応募がありません。応募が来たら、ここから始められます。</EmptyNote>
      ) : (
        <ul className={local.applicants}>
          {rc.applicants.map((a) => {
            const on = selected.includes(a.characterId);
            return (
              <li key={a.characterId} className={local.applicant}>
                <label>
                  <input type="checkbox" checked={on} onChange={() => toggle(a.characterId)} />
                  {a.characterName}（{a.playerName}）を参加させる
                </label>
                <label data-disabled={!on || undefined}>
                  <input
                    type="radio"
                    name={`driver-${rc.id}`}
                    checked={driver === a.characterId}
                    disabled={!on}
                    onChange={() => setDriver(a.characterId)}
                  />
                  {a.characterName}をドライバーにする
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className={s.form}>
        <Field label="パーティー名">
          <input
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder={
              driverName ? defaultPartyName(driverName) : '空欄ならドライバーの名前から付ける'
            }
          />
        </Field>
        {check.ok && check.warning && <p className={s.recruitNote}>{check.warning}</p>}
        <Button
          variant="ink"
          block
          disabled={!check.ok || start.isPending}
          onClick={() =>
            start.mutate(
              { recruitmentId: rc.id, characterIds, driverCharacterId: driver, partyName },
              { onSuccess: (session) => navigate(`/gm/sessions/${session.id}`) },
            )
          }
        >
          {start.isPending ? '始めています…' : 'セッションを始める'}
        </Button>
        {start.error && <ErrorNote error={start.error} />}
      </div>
    </article>
  );
}
