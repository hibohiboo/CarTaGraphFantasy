// /characters の API の一覧（docs/plans/2026-10-11-APIドキュメント.md G2）。

import { characterSchema } from '@cartagraph/domain/character/model';
import { z } from 'zod';
import { defineEndpoint, failure, success } from '../endpoint/define';
import { createCharacterBody, updateCharacterBody } from './request';

export const characterEndpoints = [
  defineEndpoint({
    method: 'get',
    path: '/characters',
    summary: '自分のキャラクターの一覧を取得する',
    responses: { 200: success('キャラクターの一覧', z.array(characterSchema)) },
  }),
  defineEndpoint({
    method: 'get',
    path: '/characters/:id',
    summary: 'キャラクターを取得する',
    responses: {
      200: success('キャラクター', characterSchema),
      404: failure('キャラクターが見つからない'),
    },
  }),
  defineEndpoint({
    method: 'post',
    path: '/characters',
    summary: 'キャラクターを作成する',
    body: createCharacterBody,
    responses: {
      201: success('作成したキャラクター', characterSchema),
      422: failure('本文の形の誤り、名前が空、能力値の配分・CP予算・カードがルールに合わない'),
    },
  }),
  defineEndpoint({
    method: 'patch',
    path: '/characters/:id',
    summary: 'キャラクターデッキにカードを足す',
    description: '能力値・HP・基本行動値は作成したあとで変えられない',
    body: updateCharacterBody,
    responses: {
      200: success('変更したキャラクター', characterSchema),
      404: failure('キャラクターが見つからない'),
      422: failure('本文の形の誤り、能力値・HP・行動値を変えようとした、カードが無い'),
    },
  }),
];
