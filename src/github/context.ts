import { readFileSync } from "node:fs";

export interface PullRequestContext {
  owner: string;
  repo: string;
  pullNumber: number;
  baseRef: string;
  headRef: string;
  prText: string;
}

interface GitHubEventPayload {
  repository?: {
    name?: string;
    owner?: {
      login?: string;
      name?: string;
    };
    full_name?: string;
  };
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
    base?: {
      sha?: string;
    };
    head?: {
      sha?: string;
    };
  };
}

export function getPullRequestContext(): PullRequestContext | undefined {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return undefined;
  }

  const payload = JSON.parse(readFileSync(eventPath, "utf8")) as GitHubEventPayload;
  const pullRequest = payload.pull_request;
  if (!pullRequest?.number || !pullRequest.base?.sha || !pullRequest.head?.sha) {
    return undefined;
  }

  const repository = payload.repository;
  const fullName = repository?.full_name;
  const owner = repository?.owner?.login ?? repository?.owner?.name ?? fullName?.split("/")[0];
  const repo = repository?.name ?? fullName?.split("/")[1];

  if (!owner || !repo) {
    return undefined;
  }

  return {
    owner,
    repo,
    pullNumber: pullRequest.number,
    baseRef: pullRequest.base.sha,
    headRef: pullRequest.head.sha,
    prText: `${pullRequest.title ?? ""}\n\n${pullRequest.body ?? ""}`
  };
}
