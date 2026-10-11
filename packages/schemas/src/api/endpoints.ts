// API の一覧のすべて（docs/plans/2026-10-11-APIドキュメント.md G2）。OpenAPI の文書（openapi.ts）と、
// モックのハンドラとの1対1・応答の検査（apps/web のテスト）が使う。並びは文書のタグの並び。

import { cardPoolEndpoints } from '../card-pool/endpoints';
import { characterEndpoints } from '../characters/endpoints';
import type { Endpoint } from '../endpoint/define';
import { libraryEndpoints } from '../library/endpoints';
import { meEndpoints } from '../me/endpoints';
import { recruitmentEndpoints } from '../recruitments/endpoints';
import { scenarioEndpoints } from '../scenarios/endpoints';
import { sessionEndpoints } from '../sessions/endpoints';

export const endpoints: readonly Endpoint[] = [
  ...meEndpoints,
  ...cardPoolEndpoints,
  ...characterEndpoints,
  ...scenarioEndpoints,
  ...recruitmentEndpoints,
  ...sessionEndpoints,
  ...libraryEndpoints,
];
