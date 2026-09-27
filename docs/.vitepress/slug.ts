/**
 * 見出しのID（アンカー）を GitHub と同じ規則で作る。英字は小文字にし、文字・数字・連結用の記号・
 * ハイフン・空白以外（括弧・中黒・全角記号など）を消して、空白をハイフンにする。Unicode の正規化はしない。
 * VitePress 既定の規則は NFKD 正規化で濁点を分解するため、「タグ」のような見出しへのリンクが
 * ブラウザで飛ばない。GitHub 上で読んでもサイトで読んでも同じリンクで飛べるようにする
 * （村スタート冒険者キャンペーン C5。リンク先の見出しの実在は scripts/check-doc-anchors.mjs で検査する）。
 * サイトの設定（config.mts）と、ダッシュボードのデータローダー（decisions.data.ts）で共有する
 */
export const githubSlug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
