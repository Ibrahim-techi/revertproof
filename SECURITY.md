# Security Policy

RevertProof is a CI tool. Treat configured commands as code execution.

## Recommended GitHub Action permissions

Use the minimum permissions required:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Do not run RevertProof with secrets on untrusted fork pull requests unless you fully trust the executed checks.

## Reporting Security Issues

Please report suspected vulnerabilities privately to the project maintainers. Do not include secrets, tokens, or exploit payloads in public issues.
