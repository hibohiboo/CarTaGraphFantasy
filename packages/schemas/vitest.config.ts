import { defineConfig } from 'vitest/config';
import { vitestTags } from '../../scripts/rule-sections.mjs';

// ルールのページの節のタグ（docs/process/rules/testing.md「ルールのテストのタグ」）。見出しに無いタグを付けたテストは落ちる
export default defineConfig({ test: { tags: vitestTags() } });
