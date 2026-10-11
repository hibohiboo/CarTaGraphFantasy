// /library の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2）。

import { libraryEntrySchema } from '@cartagraph/domain/library/model';
import { z } from 'zod';
import { defineEndpoint, success } from '../endpoint/define';

export const libraryEndpoints = [
  defineEndpoint({
    method: 'get',
    path: '/library',
    summary: '共有設定の一覧を取得する',
    responses: {
      200: success('正史グラフから格上げされた設定・カード', z.array(libraryEntrySchema)),
    },
  }),
];
