// apps/web/vite.config.ts が rule-sections.mjs を import するための型（.mjs には型が無く、tsc が TS7016 にするため）。
export interface RuleSection {
  tag: string;
  page: string;
  pageTitle: string;
  heading: string;
  level: 2 | 3;
  parent: string | null;
  provisional: boolean;
  pageProvisional: boolean;
}
export interface RulePage {
  page: string;
  pageTitle: string;
  pageProvisional: boolean;
  sections: RuleSection[];
}
export interface Exclusion {
  page: string;
  heading: string | null;
  reason: string;
}
export const RULES_DIR: string;
export const EXCLUSIONS_FILE: string;
export const TAG_PREFIX: string;
export function readRulePages(dir?: string): RulePage[];
export function readRuleSections(dir?: string): RuleSection[];
export function parseExclusions(md: string): Exclusion[];
export function readExclusions(file?: string): Exclusion[];
export function findExclusion(
  section: { page: string; heading: string },
  exclusions: Exclusion[],
): Exclusion | undefined;
export function isExcluded(
  section: { page: string; heading: string },
  exclusions: Exclusion[],
): boolean;
export function vitestTags(): { name: string; description: string }[];
