// 結果のページ（build-usecase-report.mjs・build-rule-test-report.mjs）が共用する HTML の部品。
// 見た目（状態の色・表）をそろえるために、エスケープと枠（CSS つきの <html>）をここに置く。

export const escapeHtml = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** 状態の色は `.badge.<状態>`・`.sub.<状態>` のクラスで付ける。状態名はページごとに使うものだけ使えばよい */
const REPORT_CSS = `:root { --bg:#fff; --fg:#213547; --muted:#67676c; --line:#e2e2e3; --link:#3451b2; --passed:#18794e; --failed:#b8272c; --stopped:#915930; --skipped:#7a4fc4; --none:#67676c; --noresult:#67676c; }
@media (prefers-color-scheme: dark) { :root { --bg:#1b1b1f; --fg:#dfdfd6; --muted:#98989f; --line:#2e2e32; --link:#a8b1ff; --passed:#3dd68c; --failed:#f66f81; --stopped:#f9b44e; --skipped:#c4a5ff; --none:#98989f; --noresult:#98989f; } }
body { margin:0 auto; max-width:1000px; padding:24px 16px 48px; background:var(--bg); color:var(--fg); font:16px/1.7 system-ui, sans-serif; }
a { color:var(--link); }
h1 { font-size:1.6rem; } h2 { font-size:1.2rem; margin-top:2rem; border-top:1px solid var(--line); padding-top:1rem; }
table { border-collapse:collapse; width:100%; display:block; overflow-x:auto; }
th, td { border:1px solid var(--line); padding:6px 10px; text-align:left; vertical-align:top; font-size:.9rem; }
td.id { white-space:nowrap; font-family:ui-monospace, monospace; }
ul { margin:0; padding-left:1.2em; }
.badge { white-space:nowrap; font-weight:600; }
.badge.passed, .sub.passed { color:var(--passed); } .badge.failed, .sub.failed { color:var(--failed); }
.badge.stopped, .sub.stopped { color:var(--stopped); }
.badge.skipped, .sub.skipped { color:var(--skipped); }
.badge.none, .badge.noresult, .badge.excluded, .sub.excluded { color:var(--none); }
.sub { font-size:.8rem; } .meta, .lead { color:var(--muted); font-size:.9rem; }
.notice { border:1px solid var(--failed); border-radius:6px; padding:8px 12px; color:var(--failed); }
.notice.skipped { border-color:var(--skipped); color:var(--skipped); }`;

/** ページ全体の HTML。lead・notice・body は組み立て済みの HTML（呼び出す側でエスケープする）。notice は空でもよい */
export function reportPage({ title, lead, meta, notice = '', body, extraCss = '' }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${REPORT_CSS}${extraCss ? `\n${extraCss}` : ''}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="lead">${lead}</p>
<p class="meta">${meta}</p>
${notice}
${body}
</body>
</html>
`;
}
