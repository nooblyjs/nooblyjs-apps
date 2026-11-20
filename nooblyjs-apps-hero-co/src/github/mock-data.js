// What the mock GitHub (/dev/github, development and tests only) knows: each mock user's organisations and
// repositories (the mock-up's five for stevie, product.md §9), branches, and a stable commit per branch.
import crypto from 'node:crypto';

const HOUR = 3_600_000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

export const MOCK_ORGS = {
  stevie: ['exclusivity-life', 'nooblyjs'],
  'octo-dev': [],
  'no-name': [],
};

/** Repositories each mock user can see, newest push first. */
export function mockRepos(login) {
  if (login === 'stevie') {
    return [
      { owner: 'stevie', name: 'nooblyjs-blog', language: 'JavaScript', private: false, pushedAt: ago(2 * HOUR) },
      { owner: 'exclusivity-life', name: 'digital-teammates', language: 'TypeScript', private: true, pushedAt: ago(26 * HOUR) },
      { owner: 'exclusivity-life', name: 'software-factory', language: 'TypeScript', private: true, pushedAt: ago(3 * 24 * HOUR) },
      { owner: 'stevie', name: 'space-trader', language: 'JavaScript', private: false, pushedAt: ago(8 * 24 * HOUR) },
      { owner: 'exclusivity-life', name: 'engx-platform', language: 'Dockerfile', private: true, pushedAt: ago(15 * 24 * HOUR) },
    ];
  }
  return [{ owner: login, name: 'hello-world', language: 'JavaScript', private: false, pushedAt: ago(5 * 24 * HOUR) }];
}

export const MOCK_BRANCHES = ['main', 'develop', 'release/1.4'];

/** A stable commit for a repo's branch. */
export function mockCommit(fullName, branch) {
  const sha = crypto.createHash('sha1').update(`${fullName}@${branch}`).digest('hex');
  return { sha, message: `Latest on ${branch}` };
}

/** The token the mock always accepts for a user (so a seeded connection keeps working across restarts). */
export const mockTokenFor = (login) => `gho_mock_${login}`;
