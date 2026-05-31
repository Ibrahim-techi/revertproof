# Examples

## Revert-safe

The pull request merges, forward validation passes, the synthetic rollback applies cleanly, and post-rollback validation still passes.

## Not revert-safe

The pull request cannot be proven rollback-ready because the merge, forward validation, synthetic rollback, or post-rollback validation failed.

## Revert-risky

The pull request is mechanically rollback-ready, but it touches configured risk-sensitive paths such as migrations, release files, or workflows.
