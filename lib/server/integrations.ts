import 'server-only';

// Optional real integration: follow-up tickets also become real GitHub issues.
// Off unless GITHUB_TOKEN (fine-grained, Issues: read and write on one repo) and
// GITHUB_ISSUES_REPO ("owner/name") are set. On a public demo it runs only for sandboxes
// created on the owner's device, unless GITHUB_ISSUES_PUBLIC=1, so visitors cannot spam the repo.

export function githubEnabled(owner: boolean | undefined): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_ISSUES_REPO && (owner || process.env.GITHUB_ISSUES_PUBLIC === '1'));
}

export async function createGithubIssue(title: string, body: string, timeoutMs = 8000): Promise<string | null> {
  const repo = process.env.GITHUB_ISSUES_REPO!;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'vigil-oncall-agent',
      },
      body: JSON.stringify({ title: title.slice(0, 240), body: body.slice(0, 4000) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn('[github] issue not created:', res.status);
      return null;
    }
    const data = (await res.json()) as { html_url?: string };
    return data.html_url ?? null;
  } catch (error) {
    console.warn('[github] issue failed:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
