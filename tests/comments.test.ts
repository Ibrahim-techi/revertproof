import { vi } from "vitest";
import { upsertPullRequestComment } from "../src/github/comments";

describe("upsertPullRequestComment", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("updates an existing RevertProof comment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 123,
            body: "<!-- revertproof-report -->\nOld report"
          }
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ id: 123 }));
    globalThis.fetch = fetchMock;

    await upsertPullRequestComment({
      token: "token",
      owner: "owner",
      repo: "repo",
      pullNumber: 7,
      body: "New report"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PATCH"
    });
  });

  it("creates a comment when no RevertProof comment exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 456 }));
    globalThis.fetch = fetchMock;

    await upsertPullRequestComment({
      token: "token",
      owner: "owner",
      repo: "repo",
      pullNumber: 7,
      body: "New report"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST"
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
