# Security Notes

RevertProof runs commands from your repository config. Treat those commands as code execution.

Recommended defaults:

- use `pull_request`, not `pull_request_target`;
- do not expose secrets to untrusted fork PRs;
- keep permissions minimal;
- truncate logs before sharing them publicly;
- start in advisory mode.

RevertProof evaluates rollback readiness. It does not prove correctness, production safety, or malicious intent.
