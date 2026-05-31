# Examples

## Revert-safe

The PR merges, checks pass, the synthetic revert applies cleanly, and checks still pass.

## Not revert-safe

The PR merges and forward checks pass, but after a synthetic revert the configured checks fail.

## Revert-risky

The PR can be reverted, but it touches configured high-risk paths such as migrations or release files without rollback notes.
