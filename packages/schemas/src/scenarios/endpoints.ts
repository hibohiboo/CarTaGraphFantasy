// /scenarios の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2）。
// 下書きを返しうる API は、業務の検査を外した形（scenarioDraftSchema）で書く（G10）。

import { recruitmentSchema, sessionSchema } from '@cartagraph/domain/session/model';
import { z } from 'zod';
import { defineEndpoint, failure, success } from '../endpoint/define';
import {
  createRecruitmentBody,
  createScenarioBody,
  startSoloBody,
  updateScenarioBody,
} from './request';
import {
  scenarioDraftSaveResultSchema,
  scenarioDraftSchema,
  scenarioSaveResultSchema,
} from './response';

const DRAFT_NOTE =
  '下書きは書きかけでも保存できるので、業務の検査（再挑戦不可の結末には結末タグが要る、など）を通っていないことがある。下書きの API を分けたら直す';

const notFound = failure('シナリオが見つからない');

/** 公開・非公開で同じ（どちらも公開のファイルの検査を通してから変え、開発サーバーでは scenarios/<id>.json に書く） */
const LIBRARY_STATUS_NOTE =
  '公開のファイルの検査（形・参照の整合・シナリオタイプ）を通してから変える。開発サーバーでは scenarios/<id>.json に書く';
const libraryStatusResponses = {
  200: success('変えたシナリオと、ファイルへの書き込みの結果', scenarioSaveResultSchema),
  403: failure('製作者でない'),
  404: notFound,
  422: failure('公開のファイルの検査に通らない、デモ用のシナリオ'),
  500: failure('開発サーバーでファイルに書けなかった'),
};

export const scenarioEndpoints = [
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/start-solo',
    summary: 'シナリオを自分の PC ひとりで始める（ソロ開始）',
    body: startSoloBody,
    responses: {
      201: success('始めたセッション', sessionSchema),
      404: failure('シナリオ・キャラクターが見つからない'),
      422: failure('本文の形の誤り、名前が空、遊べない PC（再挑戦不可など）'),
    },
  }),
  defineEndpoint({
    method: 'get',
    path: '/scenarios',
    summary: 'シナリオの一覧を取得する',
    description: `mine=1 なら自分が作ったシナリオ（下書きを含む）、無ければシナリオ集に公開中のシナリオ。${DRAFT_NOTE}`,
    query: z.strictObject({
      mine: z.literal('1').optional().describe('1 なら自分が作ったシナリオ（下書きを含む）'),
    }),
    responses: { 200: success('シナリオの一覧', z.array(scenarioDraftSchema)) },
  }),
  defineEndpoint({
    method: 'get',
    path: '/scenarios/:id',
    summary: 'シナリオを取得する',
    description: DRAFT_NOTE,
    responses: { 200: success('シナリオ', scenarioDraftSchema), 404: notFound },
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios',
    summary: 'シナリオを作る（下書き）',
    body: createScenarioBody,
    responses: {
      201: success('作った下書きのシナリオ', scenarioDraftSchema),
      422: failure('本文の形の誤り、タイトルが空'),
    },
  }),
  defineEndpoint({
    method: 'patch',
    path: '/scenarios/:id',
    summary: 'シナリオを保存する',
    description: `本文の項目でシナリオを上書きする。下書きは中身を検査しない。公開中のシナリオは公開のファイルの検査を通してからファイルにも書く。${DRAFT_NOTE}`,
    body: updateScenarioBody,
    responses: {
      200: success('保存したシナリオと、ファイルへの書き込みの結果', scenarioDraftSaveResultSchema),
      403: failure('製作者でない'),
      404: notFound,
      422: failure('本文がオブジェクトでない、公開中のシナリオが公開のファイルの検査に通らない'),
      500: failure('開発サーバーでファイルに書けなかった'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/publish',
    summary: 'シナリオをシナリオ集へ公開する',
    description: LIBRARY_STATUS_NOTE,
    responses: libraryStatusResponses,
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/unpublish',
    summary: 'シナリオを非公開にする（下書きに戻す）',
    description: LIBRARY_STATUS_NOTE,
    responses: libraryStatusResponses,
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/recruitments',
    summary: 'シナリオから募集を出す（GM）',
    body: createRecruitmentBody,
    responses: {
      201: success('出した募集', recruitmentSchema),
      404: notFound,
      422: failure('本文の形の誤り、募集人数・外すシーン・提案の扱いが正しくない'),
    },
  }),
];
