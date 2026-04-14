---
name: ci-cd
description: CI/CD pipelines for Next.js + Payload CMS projects. GitHub Actions workflows, testing pipelines, preview deployments, Docker builds, Coolify auto-deploy, release automation. Use when setting up CI/CD, automating builds/tests/deploys, or configuring GitHub Actions.
version: 1.0.0
---

# CI/CD for Next.js + Payload CMS

## 1. Complete GitHub Actions Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9'

jobs:
  lint-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [lint-typecheck]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm build
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
      - run: pnpm exec playwright test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint-typecheck, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - name: Cache Next.js build
        uses: actions/cache@v4
        with:
          path: .next/cache
          key: nextjs-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
          restore-keys: nextjs-${{ hashFiles('pnpm-lock.yaml') }}-
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: .next/

  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, e2e-tests]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - name: Trigger Coolify Deploy
        run: |
          curl -X POST "${{ secrets.COOLIFY_WEBHOOK_URL }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
```

## 2. Preview Deployments (PR Comment)

```yaml
# .github/workflows/preview.yml
name: Preview Deploy

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Preview
        id: deploy
        run: |
          # Vercel auto-preview or custom Docker preview
          PREVIEW_URL="https://preview-pr-${{ github.event.pull_request.number }}.example.com"
          echo "url=$PREVIEW_URL" >> $GITHUB_OUTPUT
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const body = `## 🚀 Preview Deploy
            | Status | URL |
            |--------|-----|
            | ✅ Ready | [${{ steps.deploy.outputs.url }}](${{ steps.deploy.outputs.url }}) |
            
            Commit: \`${{ github.sha }}\``;
            
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const existing = comments.find(c => c.body.includes('Preview Deploy'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body
              });
            }
```

## 3. Docker Build & Push

```yaml
# .github/workflows/docker.yml
name: Docker Build

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_APP_URL=${{ vars.APP_URL }}
```

## 4. Release Automation (Changesets)

```bash
# Setup
pnpm add -D @changesets/cli @changesets/changelog-github
pnpm changeset init
```

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - uses: changesets/action@v1
        with:
          publish: pnpm run release
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 5. Monorepo CI (Turborepo)

```yaml
# .github/workflows/ci-turbo.yml
name: CI (Monorepo)

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # needed for turbo to detect changes
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build lint test --filter='...[HEAD^1]'
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

## 6. Branch Protection Rules

```
Settings → Branches → main:
✅ Require pull request reviews (1 approver)
✅ Require status checks: lint-typecheck, unit-tests, e2e-tests, build
✅ Require branches to be up to date
✅ Require linear history (squash merge)
❌ Allow force pushes
❌ Allow deletions
```

## 7. Secrets Checklist

```
Repository Settings → Secrets and variables → Actions:

Secrets:
- DATABASE_URL          → production connection string
- COOLIFY_WEBHOOK_URL   → Coolify deploy webhook
- COOLIFY_TOKEN         → Coolify API bearer token
- PAYLOAD_SECRET        → Payload CMS secret
- SENTRY_AUTH_TOKEN     → Sentry source maps upload

Variables:
- APP_URL               → https://example.com
- TURBO_TEAM            → team_xxx (optional)
```

## Decision Tree

```
New project?
├── Solo dev, Vercel hosting → Vercel auto CI/CD (zero config)
├── Solo dev, Coolify hosting → ci.yml + docker.yml + Coolify webhook
├── Team, monorepo → ci-turbo.yml + changesets + branch protection
└── Team, multi-service → ci.yml per service + Docker Compose + preview envs
```
