# RevertProof

RevertProof checks whether a pull request is rollback-ready before it is merged.

The core question is simple:

> If this PR breaks production, can we cleanly revert it?

RevertProof simulates a merge, runs forward validation commands, performs a synthetic rollback, runs post-rollback validation commands, and reports whether the pull request is `revert-safe`, `revert-risky`, or `not-revert-safe`.

## Local Verification

From this repository:

```bash
npm install
npm run verify:local
```

The local verification script creates two temporary Git repositories:

- one pull request that is `revert-safe`;
- one pull request that is `not-revert-safe`.

Open the printed `revertproof-report.md` files to see what maintainers would see in CI.

## GitHub Action

```yaml
name: RevertProof

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  revertproof:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: Ibrahim-techi/revertproof@v0.1.1
        with:
          mode: advisory
```

## CLI

From a local checkout of this repository:

```bash
npm install
npm run build
node dist/cli.js check --base origin/main --head HEAD
```

You can run the command from the repository root or from any subdirectory inside the repository. RevertProof resolves the Git root before comparing paths.

## Statuses

- `revert-safe`: the synthetic merge worked, forward checks passed, the synthetic rollback worked, and post-rollback checks passed.
- `revert-risky`: the PR can be reverted mechanically, but it touches configured risk paths or lacks required rollback notes.
- `not-revert-safe`: the merge, forward checks, synthetic rollback, or post-rollback checks failed.
- `not-applicable`: every changed path was ignored by configuration.

## Configuration

Create `.revertproof.yml`:

```yaml
mode: advisory

checks:
  forward:
    - npm ci
    - npm test
  revert:
    - npm ci
    - npm test

risk_paths:
  migrations:
    - "db/migrations/**"
    - "migrations/**"
  workflows:
    - ".github/workflows/**"
  dependencies:
    - "package.json"
    - "package-lock.json"
    - "pnpm-lock.yaml"
    - "yarn.lock"
  release:
    - "CHANGELOG.md"
    - "release/**"
  public_api:
    - "src/**/index.ts"
    - "src/**/public/**"

require_rollback_notes_for:
  - migrations
  - release

rollback_note_patterns:
  - rollback
  - "revert plan"
  - backout
  - "migration down"
```

## What It Does

- simulates the PR merge;
- runs forward validation commands;
- attempts a synthetic rollback;
- runs post-rollback validation commands;
- detects risky changed paths;
- reports missing rollback notes for configured risk categories;
- emits Markdown and JSON reports.

## What It Does Not Do

- It does not prove that a PR is correct.
- It does not replace human review.
- It does not deploy or roll back production.
- It does not detect whether code was written by AI.

## Security

RevertProof runs only the commands you configure. Avoid running privileged or secret-bearing jobs on untrusted fork pull requests. Prefer `pull_request` over `pull_request_target`.
