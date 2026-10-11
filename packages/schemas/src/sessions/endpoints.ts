// /sessions の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2）。

import { sessionSchema } from '@cartagraph/domain/session/model';
import { z } from 'zod';
import { defineEndpoint, failure, success } from '../endpoint/define';
import {
  approveProposalBody,
  autoCombatBody,
  modeBody,
  narrateBody,
  playCardBody,
  proposeBody,
  rejectProposalBody,
} from './request';

const notFound = failure('セッションが見つからない');
const ok = success('変更したセッション', sessionSchema);

export const sessionEndpoints = [
  defineEndpoint({
    method: 'get',
    path: '/sessions',
    summary: 'セッションの一覧を取得する',
    responses: { 200: success('セッションの一覧', z.array(sessionSchema)) },
  }),
  defineEndpoint({
    method: 'get',
    path: '/sessions/:id',
    summary: 'セッションを取得する',
    responses: { 200: success('セッション', sessionSchema), 404: notFound },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/play',
    summary: '手札のカードをプレイする',
    body: playCardBody,
    responses: {
      200: ok,
      404: failure('セッション・カードが見つからない'),
      422: failure('本文の形の誤り、進行中でない、戦闘中、使える条件を満たさない'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/proposals',
    summary: '新たな選択肢を提案する',
    body: proposeBody,
    responses: {
      201: success('提案を足したセッション', sessionSchema),
      404: notFound,
      422: failure('本文の形の誤り、提案が空、進行中でない、戦闘中、提案できないセッション'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/proposals/:pid/approve',
    summary: '提案を採用する（GM）',
    body: approveProposalBody,
    responses: {
      200: ok,
      404: failure('セッション・提案が見つからない'),
      422: failure('本文の形の誤り、カード名が空、終了済み、裁定済み、移り先が選べない'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/proposals/:pid/reject',
    summary: '提案を却下する（GM）',
    body: rejectProposalBody,
    responses: {
      200: ok,
      404: failure('セッション・提案が見つからない'),
      422: failure('本文の形の誤り、終了済み、裁定済み'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/resume',
    summary: '中断したセッションを再開する',
    description:
      '仕様とずれている所：仕様（docs/cartagraph/party-and-session.md「中断」）はドライバーも GM も再開できるが、モックはドライバーだけを通す。要望 docs/backlog/gm-resume-suspended.md で直す',
    responses: {
      200: ok,
      403: failure('ドライバーでない'),
      404: notFound,
      422: failure('中断していない、再開のしかたが決まっていない、GM の裁定待ち'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/narrate',
    summary: '描写を書き、選択肢を配る・取り下げる（GM）',
    body: narrateBody,
    responses: {
      200: ok,
      403: failure('このセッションの GM でない'),
      404: notFound,
      422: failure('本文の形の誤り、GM 不在のセッション、進行中でない、選択肢の指定が正しくない'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/mode',
    summary: '軽量モード・濃密モードを切り替える（GM）',
    body: modeBody,
    responses: {
      200: ok,
      404: notFound,
      422: failure('本文の形の誤り、GM 不在のセッション、進行中でない'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/end',
    summary: 'セッションの終了を宣言する',
    description: '裁定待ちの提案は「今回は使われなかった」で閉じる',
    responses: { 200: ok, 404: notFound },
  }),
  defineEndpoint({
    method: 'post',
    path: '/sessions/:id/auto-combat',
    summary: '戦い方（優先順位）を決めて自動戦闘を解決する',
    description: '自動戦闘は仮ルール（docs/provisional/auto-combat.md）。決着まで一括で解決する',
    body: autoCombatBody,
    responses: {
      200: ok,
      404: notFound,
      422: failure('本文の形の誤り、戦闘中でない、進行中でない、優先順位の行が正しくない'),
    },
  }),
];
