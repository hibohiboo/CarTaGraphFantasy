/** 「扉を壊してみたい」「音を確かめたい」のような提案文を、カード名に使う辞書形（「扉を壊す」「音を確かめる」）に近づける簡易変換 */
const I_STEM_TO_U: Record<string, string> = {
  し: 'す',
  き: 'く',
  ぎ: 'ぐ',
  み: 'む',
  び: 'ぶ',
  に: 'ぬ',
  り: 'る',
  い: 'う',
  ち: 'つ',
};

export function toDictionaryForm(text: string): string {
  const t = text.trim();
  const m = /^(.*?)(てみたい|でみたい|たい)$/.exec(t);
  if (!m) return t;
  let stem = m[1];
  if (m[2] === 'てみたい' || m[2] === 'でみたい') {
    // 「壊してみたい」→「壊し」、「読んでみたい」→「読ん」→ 辞書形は難しいので「壊す」「読む」の近似
    if (m[2] === 'でみたい') return `${stem.replace(/ん$/, '')}む`;
    const last = stem.slice(-1);
    if (last === 'し') return `${stem.slice(0, -1)}す`;
    if (last === 'い') return `${stem.slice(0, -1)}く`;
    if (last === 'っ') return `${stem.slice(0, -1)}る`;
    return `${stem}る`;
  }
  const last = stem.slice(-1);
  if (last in I_STEM_TO_U) return `${stem.slice(0, -1)}${I_STEM_TO_U[last]}`;
  // 一段動詞（見たい・確かめたい・開けたい）
  stem = `${stem}る`;
  return stem;
}
