// check-main-ci.mjs の知らせる条件（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarize } from './check-main-ci.mjs';

const run = (over) => ({
  status: 'completed',
  conclusion: 'success',
  headSha: 'dc63c7c0123456',
  displayTitle: 'chore: メモ',
  url: 'https://example.invalid/run/1',
  ...over,
});

describe('summarize', () => {
  it('最新の完了した CI が失敗なら、コミットと URL を添えて知らせる', () => {
    const message = summarize([run({ conclusion: 'failure' })]);
    assert.match(message, /最新の CI が failure/);
    assert.match(message, /dc63c7c chore: メモ/);
    assert.match(message, /https:\/\/example\.invalid\/run\/1/);
  });

  it('最新が成功なら、その前に失敗があっても知らせない', () => {
    assert.equal(summarize([run({}), run({ conclusion: 'failure' })]), '');
  });

  it('実行中のものは飛ばし、完了した中で最新のものを見る', () => {
    const message = summarize([
      run({ status: 'in_progress', conclusion: '' }),
      run({ conclusion: 'failure' }),
    ]);
    assert.match(message, /failure/);
  });

  it('取り消し（cancelled）は知らせない。完了したものが無ければ知らせない', () => {
    assert.equal(summarize([run({ conclusion: 'cancelled' })]), '');
    assert.equal(summarize([]), '');
  });
});
