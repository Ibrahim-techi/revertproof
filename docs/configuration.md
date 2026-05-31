# Configuration

RevertProof reads `.revertproof.yml`.

```yaml
mode: advisory

checks:
  forward:
    - npm test
  revert:
    - npm test

risk_paths:
  migrations:
    - "db/migrations/**"
  workflows:
    - ".github/workflows/**"

require_rollback_notes_for:
  - migrations

rollback_note_patterns:
  - rollback
  - "revert plan"

ignore_paths:
  - "docs/**"

comment_mode: failures-only
```

## Modes

- `advisory`: reports findings but does not fail CI.
- `required`: fails when the PR is `not-revert-safe`.

## Comment Modes

- `always`: always write or update a PR comment.
- `failures-only`: comment only when maintainer attention is needed.
- `never`: do not comment.
