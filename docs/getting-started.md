# Getting Started

RevertProof checks whether a pull request is rollback-ready before merge.

## Local usage

From a local checkout of this repository:

```bash
npm install
npm run build
node dist/cli.js check --base origin/main --head HEAD
```

You can run the CLI from the repository root or from a nested folder inside the repository. RevertProof resolves the Git root before it compares changed paths.

## Run local verification

When working from the RevertProof repository itself, run:

```bash
npm install
npm run verify:local
```

The verification script creates temporary repositories and shows one `revert-safe` PR and one `not-revert-safe` PR.

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
          github-token: ${{ github.token }}
```

## First useful config

```yaml
checks:
  forward:
    - npm ci
    - npm test
  revert:
    - npm ci
    - npm test
```

Start in advisory mode, review the reports for a few pull requests, then decide whether to make failures required.
