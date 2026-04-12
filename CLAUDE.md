# CLAUDE.md

このファイルは Claude Code がこのモノレポで作業する際のガイダンスを提供します。

**会話は日本語で行う。**

## リポジトリ構成

```
apps/
├── ai-tools/    # AI ツール群（Nuxt 3 + Nitro + Cloudflare Workers）
└── homepages/   # 静的ホームページ群（Nuxt 3 + Tailwind CSS）
```

## コマンド

```bash
yarn dev              # ai-tools（:3000）と homepages（:3001）を同時起動
yarn dev:tools        # ai-tools のみ起動
yarn dev:homepages    # homepages のみ起動
yarn build:tools      # ai-tools をビルド（Cloudflare Workers向け）
yarn build:homepages  # homepages をビルド（静的生成）
```

各アプリの詳細は `apps/ai-tools/CLAUDE.md` を参照。
