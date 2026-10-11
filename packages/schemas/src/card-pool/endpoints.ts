// /card-pool の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2）。

import { defineEndpoint, success } from '../endpoint/define';
import { cardPoolSchema } from './response';

export const cardPoolEndpoints = [
  defineEndpoint({
    method: 'get',
    path: '/card-pool',
    summary: 'キャラクター作成のカードプールとルールを取得する',
    description:
      '基本カードプール・解放済みカードプール・CP 予算と、能力値の配分・作成時の HP と基本行動値（仮ルール）',
    responses: { 200: success('カードプールとキャラクター作成のルール', cardPoolSchema) },
  }),
];
