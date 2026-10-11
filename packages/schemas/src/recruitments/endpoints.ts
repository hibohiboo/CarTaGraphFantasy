// /recruitments の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2）。

import { recruitmentSchema, sessionSchema } from '@cartagraph/domain/session/model';
import { z } from 'zod';
import { defineEndpoint, failure, success } from '../endpoint/define';
import { applyBody, playFromRecruitmentBody, startRecruitmentBody } from './request';

export const recruitmentEndpoints = [
  defineEndpoint({
    method: 'get',
    path: '/recruitments',
    summary: '受付中の募集の一覧を取得する',
    responses: { 200: success('受付中の募集', z.array(recruitmentSchema)) },
  }),
  defineEndpoint({
    method: 'post',
    path: '/recruitments/:id/apply',
    summary: '募集に応募する',
    body: applyBody,
    responses: {
      200: success('応募を足した募集', recruitmentSchema),
      404: failure('募集・キャラクターが見つからない'),
      409: failure('このPCは応募済み'),
      422: failure('本文の形の誤り、受付中でない、GM 不在の募集'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/recruitments/:id/start',
    summary: '募集からセッションを始める（GM）',
    body: startRecruitmentBody,
    responses: {
      201: success('始めたセッション', sessionSchema),
      403: failure('自分が出した募集でない'),
      404: failure('募集が見つからない'),
      422: failure('本文の形の誤り、参加させる PC・ドライバーの指定が正しくない、受付中でない'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/recruitments/:id/play',
    summary: 'GM 不在の募集から自分の PC ですぐ始める',
    body: playFromRecruitmentBody,
    responses: {
      201: success('始めたセッション', sessionSchema),
      404: failure('募集・キャラクターが見つからない'),
      422: failure('本文の形の誤り、GM 不在の募集でない、遊べない PC（再挑戦不可など）'),
    },
  }),
];
