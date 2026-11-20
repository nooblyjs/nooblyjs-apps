// GitHub repository access for a workspace (roadmap 2.4; product.md §11 [GITHUB]: the OAuth app for now, a GitHub
// App later). The workspace Owner connects once with the `repo read:org` scope; the token is sealed in hero_github.
// Repositories are cached for a few minutes per workspace; branches and the branch's latest commit are asked for when
// needed. Without GITHUB_CLIENT_ID (outside production) it talks to the mock at /dev/github.
const SCOPE = 'repo read:org';
const CACHE_MS = 5 * 60_000;

export class GithubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {object} o
 * @param {ReturnType<import('../domain/records.js').createRecords>} o.records
 * @param {Awaited<ReturnType<import('../domain/secrets.js').createSecrets>>} o.secrets
 * @param {{ publicUrl: string, production: boolean, github: { clientId?: string, clientSecret?: string } }} o.config
 * @param {typeof fetch} [o.fetchImpl]
 */
export function createGithub({ records, secrets, config, fetchImpl = fetch }) {
  const mock = !config.github?.clientId && !config.production;
  const enabled = Boolean(config.github?.clientId) || mock;
  const web = mock ? `${config.publicUrl}/dev/github` : 'https://github.com';
  const apiBase = mock ? `${config.publicUrl}/dev/github/api` : 'https://api.github.com';
  const clientId = config.github?.clientId ?? 'mock-client-id';
  const clientSecret = config.github?.clientSecret ?? 'mock-client-secret';
  const cache = new Map();
  const context = (workspaceId) => `github:${workspaceId}`;

  async function call(token, path) {
    const res = await fetchImpl(`${apiBase}${path}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'nooblyjs-cloud', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (res.status === 401) throw new GithubError(401, 'GitHub no longer accepts this connection. The workspace owner connects it again.');
    if (res.status === 404) throw new GithubError(404, 'GitHub has no such repository, or the connection cannot see it.');
    if (!res.ok) throw new GithubError(502, `GitHub answered ${res.status}. Try again in a moment.`);
    return res.json();
  }

  async function tokenOf(workspaceId) {
    const c = await records.github.get(workspaceId);
    if (!c) throw new GithubError(409, 'Connect GitHub first.');
    return secrets.open(c.tokenSealed, context(workspaceId));
  }

  async function repos(workspaceId, { refresh = false } = {}) {
    const hit = cache.get(workspaceId);
    if (hit && !refresh && hit.until > Date.now()) return hit.repos;
    const list = await call(await tokenOf(workspaceId), '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member');
    const out = list.map((r) => ({
      owner: r.owner?.login, name: r.name, fullName: r.full_name, private: Boolean(r.private),
      language: r.language ?? null, pushedAt: r.pushed_at ?? null, defaultBranch: r.default_branch ?? 'main',
    }));
    cache.set(workspaceId, { repos: out, until: Date.now() + CACHE_MS });
    return out;
  }

  /** The repository, if the connection can see it. */
  async function repo(workspaceId, fullName) {
    const found = (await repos(workspaceId)).find((r) => r.fullName === fullName);
    if (!found) throw new GithubError(404, 'GitHub has no such repository, or the connection cannot see it.');
    return found;
  }

  return {
    enabled,
    mock,
    /** Where the Owner is sent to grant access. */
    authorizeUrl: (state, redirectUri) => `${web}/login/oauth/authorize?${new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: SCOPE, state, allow_signup: 'false' })}`,
    async exchange(code, redirectUri) {
      const res = await fetchImpl(`${web}/login/oauth/access_token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.access_token) throw new GithubError(400, 'GitHub did not grant access. Try connecting again.');
      return body.access_token;
    },
    /** Stores the connection: who it is on GitHub and their organisations. */
    async connect(workspaceId, token, person) {
      const user = await call(token, '/user');
      const orgs = await call(token, '/user/orgs');
      cache.delete(workspaceId);
      const record = await records.github.set(workspaceId, {
        login: user.login, organisations: orgs.map((o) => o.login), tokenSealed: secrets.seal(token, context(workspaceId)),
        connectedAt: new Date().toISOString(), connectedBy: person ? { id: person.id, name: person.name } : null,
      });
      return record;
    },
    async disconnect(workspaceId) {
      cache.delete(workspaceId);
      await records.github.remove(workspaceId);
    },
    status: (workspaceId) => records.github.get(workspaceId),
    repos,
    repo,
    async branches(workspaceId, fullName) {
      await repo(workspaceId, fullName);
      const list = await call(await tokenOf(workspaceId), `/repos/${fullName}/branches?per_page=100`);
      return list.map((b) => b.name);
    },
    /** The branch's latest commit: { sha, message }. */
    async latestCommit(workspaceId, fullName, branch) {
      const c = await call(await tokenOf(workspaceId), `/repos/${fullName}/commits/${encodeURIComponent(branch)}`);
      return { sha: c.sha, message: String(c.commit?.message ?? '').split('\n')[0].slice(0, 200) };
    },
  };
}
