# RevertProof

RevertProof checks whether a pull request can be safely backed out before it is merged.

The core question is simple:

> If this PR breaks production, can we cleanly revert it?

RevertProof simulates a merge, runs your checks, reverts the merged change, runs checks again, and reports whether the PR is revert-safe, revert-risky, or not revert-safe.

## Try It Locally

From this repository:

```bash
npm install
npm run demo:local
```

The demo creates two temporary Git repositories:

- one PR that is `revert-safe`;
- one PR that is `not-revert-safe`.

Open the printed `revertproof-report.md` files to see what maintainers would see in CI.

## Install

```bash
npm install --save-dev revertproof
```

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
      - uses: revertproof/revertproof@v0
        with:
          mode: advisory
```

## CLI

```bash
npx revertproof check --base origin/main --head HEAD
```

You can run the command from the repository root or from any subdirectory inside the repository. RevertProof resolves the Git root before comparing paths.

## Statuses

- `revert-safe`: the synthetic merge worked, forward checks passed, the synthetic revert worked, and revert checks passed.
- `revert-risky`: the PR can be reverted mechanically, but it touches configured risk paths or lacks required rollback notes.
- `not-revert-safe`: the merge, forward checks, revert, or post-revert checks failed.
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
- runs forward checks;
- attempts a synthetic revert;
- runs revert checks;
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


Testing RevertProof in a real Pull Request.