// セッションの API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の6〜12）。
// 形だけを書く。空の文字列・選べる移り先・使う条件が3種のどれか・優先順位が1枚以上かなどは、受け取る側
// （ドメインの検査を含む）が今のメッセージで検査する。

import { sessionModeSchema } from '@cartagraph/domain/session/model';
import { z } from 'zod';
import { defineBody } from '../body/parse';

/** POST /sessions/:id/play */
export const playCardBody = defineBody(z.object({ cardId: z.string() }));

/** POST /sessions/:id/proposals */
export const proposeBody = defineBody(z.object({ text: z.string() }));

/** POST /sessions/:id/proposals/:pid/approve：移り先は省ける（空文字は「付けない」） */
export const approveProposalBody = defineBody(
  z.object({ cardName: z.string(), nextNodeId: z.string().optional() }),
  { nextNodeId: '移り先の指定の形が正しくありません' },
);

/** POST /sessions/:id/proposals/:pid/reject：理由は省ける（受け取る側が「理由未記入」にする） */
export const rejectProposalBody = defineBody(z.object({ reason: z.string().optional() }));

const NARRATION_FORM = '描写・選択肢の指定の形が正しくありません';

/** POST /sessions/:id/narrate：省いた項目は空として扱う */
export const narrateBody = defineBody(
  z.object({
    flavor: z.string().optional(),
    withdrawCardIds: z.array(z.string()).optional(),
    choices: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          nextNodeId: z.string().optional(),
        }),
      )
      .optional(),
  }),
  {
    '': NARRATION_FORM,
    flavor: NARRATION_FORM,
    withdrawCardIds: NARRATION_FORM,
    choices: NARRATION_FORM,
  },
);

/** POST /sessions/:id/mode */
export const modeBody = defineBody(z.object({ mode: sessionModeSchema }));

const PRIORITY_FORM = '優先順位の行の形が正しくありません（各行はカードIDと使う条件の組）';

/**
 * POST /sessions/:id/auto-combat：使う条件は文字列であることだけを見る。3種のどれかと、1枚以上あるかは
 * ドメインの validatePriority が今のメッセージで検査する
 */
export const autoCombatBody = defineBody(
  z.object({
    priority: z.array(z.object({ cardId: z.string(), when: z.string() })).optional(),
  }),
  { '': PRIORITY_FORM, priority: PRIORITY_FORM },
);
