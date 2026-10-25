import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeHtml, reportPage } from './report-html.mjs';

describe('escapeHtml', () => {
  it('& < > " \' をエスケープし、ほかはそのまま', () => {
    assert.equal(escapeHtml(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&#39;f');
    assert.equal(escapeHtml('日本語 abc'), '日本語 abc');
  });

  it('文字列でない値も文字列にする', () => {
    assert.equal(escapeHtml(12), '12');
  });
});

describe('reportPage', () => {
  const page = (over = {}) =>
    reportPage({
      title: '題<x>',
      lead: '<a href="#">導入</a>',
      meta: 'm',
      body: '<p>本文</p>',
      ...over,
    });

  it('題はエスケープし、lead・body は組み立て済みの HTML としてそのまま入れる', () => {
    const html = page();
    assert.ok(html.includes('<title>題&lt;x&gt;</title>'));
    assert.ok(html.includes('<h1>題&lt;x&gt;</h1>'));
    assert.ok(html.includes('<a href="#">導入</a>'));
    assert.ok(html.includes('<p>本文</p>'));
  });

  it('extraCss を共用の CSS の後ろに足す。無ければ足さない', () => {
    assert.ok(page({ extraCss: '.only-here{}' }).includes('.only-here{}'));
    assert.ok(!page().includes('.only-here'));
  });
});
