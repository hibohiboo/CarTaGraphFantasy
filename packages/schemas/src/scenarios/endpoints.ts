// /scenarios の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2、docs/plans/2026-10-11-シナリオの下書きのAPI.md G3）。
// シナリオは公開版（GM・PL が使う）と下書き（製作者の書きかけ）に分かれる。/scenario-drafts は URL の最初の区切りが
// 違うが、ScenarioDraftView（./response）を使うのでここに置く（docs/process/rules/architecture.md「packages/schemas の中の置き場所」）。

import { scenarioSchema } from '@cartagraph/domain/scenario/model';
import { recruitmentSchema, sessionSchema } from '@cartagraph/domain/session/model';
import { z } from 'zod';
import { defineEndpoint, failure, success } from '../endpoint/define';
import {
  createRecruitmentBody,
  createScenarioBody,
  startSoloBody,
  updateScenarioBody,
} from './request';
import { scenarioDraftViewSchema, scenarioSaveResultSchema } from './response';

const notFound = failure('シナリオが見つからない');
const notAuthor = failure('製作者でない');
const NOT_STARTABLE = 'シナリオ集に載っていない（公開版が無い・外した）';

/** 公開・非公開で同じ（どちらも公開のファイルの検査を通してから変え、開発サーバーでは scenarios/<id>.json に書く） */
const LIBRARY_STATUS_NOTE =
  '公開のファイルの検査（形・参照の整合・シナリオタイプ）を通してから変える。開発サーバーでは scenarios/<id>.json に書く。失敗すれば公開版・一覧・下書きは変わらない';
const libraryStatusResponses = (unprocessable: string) => ({
  200: success('変えた公開版と、ファイルへの書き込みの結果', scenarioSaveResultSchema),
  403: notAuthor,
  404: notFound,
  422: failure(unprocessable),
  500: failure('開発サーバーでファイルに書けなかった'),
});

export const scenarioEndpoints = [
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/start-solo',
    summary: 'シナリオを自分の PC ひとりで始める（ソロ開始）',
    description: 'シナリオ集に載っているシナリオだけから始められる',
    body: startSoloBody,
    responses: {
      201: success('始めたセッション', sessionSchema),
      404: failure('シナリオ・キャラクターが見つからない'),
      422: failure(`本文の形の誤り、${NOT_STARTABLE}、名前が空、遊べない PC（再挑戦不可など）`),
    },
  }),
  defineEndpoint({
    method: 'get',
    path: '/scenarios',
    summary: 'シナリオ集のシナリオの一覧を取得する',
    description: 'シナリオ集に載っている公開版',
    responses: { 200: success('シナリオ集のシナリオ', z.array(scenarioSchema)) },
  }),
  defineEndpoint({
    method: 'get',
    path: '/scenarios/:id',
    summary: 'シナリオの公開版を取得する',
    description:
      'シナリオ集から外したシナリオも返す（既にある募集・セッションと、製作者でない人が読むため）。下書きは /scenarios/{id}/draft',
    responses: { 200: success('公開版', scenarioSchema), 404: failure('公開版が無い') },
  }),
  defineEndpoint({
    method: 'get',
    path: '/scenarios/:id/versions/:version',
    summary: 'シナリオの版を取得する',
    description:
      '公開・公開し直すたびにできる版のうち、募集とセッションが指す版を読む。版の中身は変わらない。だれでも読める。`version` は1以上の整数（先頭に0を付けない）。`libraryStatus` はシナリオ集の今の状態',
    responses: {
      200: success('その版', scenarioSchema),
      404: failure('公開版が無い、その版が無い、版番号として読めない'),
    },
  }),
  defineEndpoint({
    method: 'get',
    path: '/scenario-drafts',
    summary: '自分のシナリオの下書きの一覧を取得する（製作者）',
    responses: {
      200: success('自分の下書きと公開の状態', z.array(scenarioDraftViewSchema)),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios',
    summary: 'シナリオを作る（下書き）',
    description: '公開版は作らない。シナリオ集へ公開すると公開版ができる',
    body: createScenarioBody,
    responses: {
      201: success('作った下書き', scenarioDraftViewSchema),
      422: failure('本文の形の誤り、タイトルが空'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/copy',
    summary: 'シナリオをコピーして自分の下書きにする',
    description:
      '公開版のあるシナリオの最新の公開版を、自分の下書きとしてコピーする。最新の公開版の写しで、題名は「〇〇のコピー」、作者は自分、どの版から作ったかを `copiedFrom` に持つ。公開版は作らない。だれでもコピーできる（シナリオ集から外したシナリオも）',
    responses: {
      201: success('コピーした下書きと公開の状態', scenarioDraftViewSchema),
      404: failure('公開版が無い'),
      422: failure('デモ・テスト専用のシナリオ'),
    },
  }),
  defineEndpoint({
    method: 'get',
    path: '/scenarios/:id/draft',
    summary: 'シナリオの下書きを取得する（製作者）',
    responses: {
      200: success('下書きと公開の状態', scenarioDraftViewSchema),
      403: notAuthor,
      404: notFound,
    },
  }),
  defineEndpoint({
    method: 'patch',
    path: '/scenarios/:id/draft',
    summary: 'シナリオの下書きを保存する（製作者）',
    description:
      '本文の項目で下書きを上書きし、上書きした結果の形を検査する（業務の検査はしない）。公開版とファイルは変わらない（公開し直すまで GM・PL に届かない）。id・作者・libraryStatus・updatedAt・copiedFrom はサーバーが決める',
    body: updateScenarioBody,
    responses: {
      200: success('保存した下書きと公開の状態', scenarioDraftViewSchema),
      403: notAuthor,
      404: notFound,
      422: failure('本文がオブジェクトでない、上書きした下書きの形が正しくない'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/publish',
    summary: 'シナリオ集へ公開する・公開し直す',
    description: `下書きを公開版にしてシナリオ集に載せる。${LIBRARY_STATUS_NOTE}`,
    responses: libraryStatusResponses('下書きが公開のファイルの検査に通らない、デモ用のシナリオ'),
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/unpublish',
    summary: 'シナリオ集から外す（非公開にする）',
    description: `公開版をシナリオ集から外す。下書きは変えない。既にある募集・セッションは残る。${LIBRARY_STATUS_NOTE}`,
    responses: libraryStatusResponses('公開版が無い、デモ用のシナリオ'),
  }),
  defineEndpoint({
    method: 'post',
    path: '/scenarios/:id/recruitments',
    summary: 'シナリオから募集を出す（GM）',
    description: 'シナリオ集に載っているシナリオだけから出せる',
    body: createRecruitmentBody,
    responses: {
      201: success('出した募集', recruitmentSchema),
      404: notFound,
      422: failure(
        `本文の形の誤り、${NOT_STARTABLE}、募集人数・外すシーン・提案の扱いが正しくない`,
      ),
    },
  }),
];
