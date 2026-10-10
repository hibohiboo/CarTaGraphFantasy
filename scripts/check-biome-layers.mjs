// biome.json の層ごとの import の禁止（noRestrictedImports）が、層の表と食い違っていないかを確かめる
// （pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// Biome は、同じファイルに当たる後ろの override の noRestrictedImports で、前の override の禁止を丸ごと置き換える。
// そのため禁止は、層の override と、層の直下のファイル用の override の両方に書く必要があり、足し忘れると黙って効かない
// （2026-10-10、API のスキーマの共用で @cartagraph/schemas の禁止を9か所に足した。その振り返りで採用）。
// 表の正はこのファイルの LAYERS・PACKAGES、理由は docs/process/rules/architecture.md「依存の向き」。
// biome.json の禁止を全部ここから作り直すことはしない（相対パスの抜け道を塞ぐ禁止など、層ごとに書き分けたものが多いため）。
// ここで確かめるのは「必要な禁止が、層の名前のついた override のどれにも欠けていない」ことだけ。
//
// 使い方: node scripts/check-biome-layers.mjs
// テストは scripts/check-biome-layers.test.mjs（pnpm tools:test）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** FSD の層。上から順に、下の層だけを import してよい（app はどの層も import してよい） */
export const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
/** 層の外で、どの層からも import しないもの */
const OUTSIDE = ['mocks', 'test'];
/** 層を限って import させるパッケージと、import してよい層 */
const PACKAGES = { '@cartagraph/schemas': ['entities'] };

/** その層の override が持つべき禁止の group */
export function requiredGroups(layer) {
  const index = LAYERS.indexOf(layer);
  const layers = index === 0 ? [] : LAYERS.slice(0, index + 1);
  const aliases = [...layers, ...OUTSIDE].flatMap((l) => [`@/${l}`, `@/${l}/**`]);
  const packages = Object.entries(PACKAGES)
    .filter(([, allowed]) => !allowed.includes(layer))
    .flatMap(([name]) => [name, `${name}/**`]);
  return [...aliases, ...packages];
}

/** override が当たる層（層の名前を含まないなら null） */
function layerOf(override) {
  for (const include of override.includes ?? []) {
    const layer = include.match(/^apps\/web\/src\/([^/*]+)/)?.[1];
    if (layer && LAYERS.includes(layer)) return layer;
  }
  return null;
}

/** 食い違いの文の一覧（無ければ空）。requireAll なら、どの層にも禁止の override があることも見る */
export function findLayerErrors(config, { requireAll = true } = {}) {
  const errors = [];
  const seen = new Set();
  for (const override of config.overrides ?? []) {
    const rule = override.linter?.rules?.style?.noRestrictedImports;
    const layer = layerOf(override);
    if (!rule || !layer) continue;
    seen.add(layer);
    const groups = new Set((rule.options?.patterns ?? []).flatMap((p) => p.group ?? []));
    const missing = requiredGroups(layer).filter((g) => !groups.has(g));
    if (missing.length)
      errors.push(
        `biome.json の ${override.includes[0]} の noRestrictedImports に、${missing.join('・')} の禁止が無い（後ろの override は前の禁止を置き換えるので、この override にも書く）`,
      );
  }
  if (requireAll)
    for (const layer of LAYERS.filter((l) => !seen.has(l)))
      errors.push(`biome.json に ${layer} の層の noRestrictedImports が無い（層の表と食い違う）`);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = findLayerErrors(JSON.parse(readFileSync('biome.json', 'utf8')));
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log(
    `biome.json の層ごとの import の禁止が、層の表（${LAYERS.length} 層）と一致しています`,
  );
}
