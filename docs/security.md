# Security Notes

RevertProof runs commands from your repository config. Treat those commands as code execution.

Recommended defaults:

- use `pull_request`, not `pull_request_target`;
- do not expose secrets to untrusted fork PRs;
- keep permissions minimal;
- truncate logs before sharing them publicly;
- start in advisory mode.

RevertProof proves revertability. It does not prove correctness, safety, or malicious intent.
