---
paths:
  - "apps/**/*.test.*"
  - "packages/**/*.test.*"
  - "apps/web/src/test/**"
  - "apps/web/src/mocks/**"
  - "scenarios/**"
  - "rules/**"
  - "apps/web/vite.config.ts"
  - "apps/web/vite/**"
  - "apps/web/e2e/**"
  - "apps/web/playwright.config.ts"
---

<!-- node scripts/sync-claude-rules.mjs が docs/process/rules/testing.md の frontmatter から作る。手で直さない -->

このパスのファイルを読む・変更する・レビューする前に、`docs/process/rules/testing.md` を読み、そこに書かれたルールに従う。ルールの本文と対象のパスの正はそちら（AGENTS.md「開発ルールの適用」）。
