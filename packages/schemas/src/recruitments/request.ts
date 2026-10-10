// 募集の API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の1〜3）。
// 形だけを書く。誰を参加させられるか・ドライバーが参加者の中にいるかなどは、受け取る側が今のメッセージで検査する。

import { z } from 'zod';
import { defineBody } from '../body/parse';

/** POST /recruitments/:id/apply */
export const applyBody = defineBody(z.object({ characterId: z.string() }));

/** POST /recruitments/:id/start：省いた項目は空として扱う（選んでいないことの検査は受け取る側） */
export const startRecruitmentBody = defineBody(
  z.object({
    characterIds: z.array(z.string()).optional(),
    driverCharacterId: z.string().optional(),
    partyName: z.string().optional(),
  }),
  { characterIds: '参加させるPCの指定の形が正しくありません' },
);

/** POST /recruitments/:id/play：characterId が無ければ、受け取る側が「キャラクターが見つかりません」（404） */
export const playFromRecruitmentBody = defineBody(z.object({ characterId: z.string().optional() }));
