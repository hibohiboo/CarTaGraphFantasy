// /me の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2）。

import { currentUserSchema } from '@cartagraph/domain/user/model';
import { defineEndpoint, success } from '../endpoint/define';

export const meEndpoints = [
  defineEndpoint({
    method: 'get',
    path: '/me',
    summary: 'ログインユーザーを取得する',
    description: 'バックエンドが無いので、モックで固定の利用者を返す',
    responses: { 200: success('ログインユーザー', currentUserSchema) },
  }),
];
