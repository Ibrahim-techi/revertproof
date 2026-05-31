const MARKER = "<!-- revertproof-report -->";
const API_VERSION = "2022-11-28";

export interface UpsertCommentOptions {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
}

interface IssueComment {
  id: number;
  body?: string;
}

export async function upsertPullRequestComment(options: UpsertCommentOptions): Promise<void> {
  const body = `${MARKER}\n${options.body}`;
  const comments = await listComments(options);
  const existing = comments.find((comment) => comment.body?.includes(MARKER));

  if (existing) {
    await githubRequest(
      options.token,
      "PATCH",
      `/repos/${options.owner}/${options.repo}/issues/comments/${existing.id}`,
      { body }
    );
    return;
  }

  await githubRequest(
    options.token,
    "POST",
    `/repos/${options.owner}/${options.repo}/issues/${options.pullNumber}/comments`,
    { body }
  );
}

async function listComments(options: UpsertCommentOptions): Promise<IssueComment[]> {
  const comments: IssueComment[] = [];

  for (let page = 1; ; page += 1) {
    const pageComments = await githubRequest<IssueComment[]>(
      options.token,
      "GET",
      `/repos/${options.owner}/${options.repo}/issues/${options.pullNumber}/comments?per_page=100&page=${page}`
    );
    comments.push(...pageComments);

    if (pageComments.length < 100) {
      return comments;
    }
  }
}

async function githubRequest<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "revertproof",
      "x-github-api-version": API_VERSION
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${method} ${path} failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
