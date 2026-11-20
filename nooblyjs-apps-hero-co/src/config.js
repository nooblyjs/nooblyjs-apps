import fs from 'node:fs';
// Configuration from the environment (stack.md §6). Read once, by createApp() or app.js; tests pass their own.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_PORT = 11010;

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ port: number, dataDir: string, production: boolean, publicUrl: string, appDomain: string,
 *   trustProxy: boolean, devSignIn: boolean, cxTrackingSecret: string|undefined, sessionSecret: string|undefined,
 *   github: { clientId: string|undefined, clientSecret: string|undefined }, secretKey: string|undefined }}
 */
function localAgentOf(env, production) {
  if (['fork', 'mock', 'off'].includes(env.HERO_LOCAL_AGENT)) return env.HERO_LOCAL_AGENT;
  if (env.NODE_ENV === 'test') return 'mock';
  if (production) return 'off';
  return fs.existsSync('/var/run/docker.sock') ? 'fork' : 'off';
}

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? DEFAULT_PORT);
  return {
    port,
    dataDir: path.resolve(ROOT, env.DATA_DIR ?? '.application'),
    production,
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
    appDomain: env.APP_DOMAIN ?? 'nooblyjs.app',
    // The agent for the Local network region (infra spec 8.9) on this machine: 'fork' runs the real agent with this
    // machine's Docker, 'mock' an in-process one (tests), 'off' none. Default: 'mock' in tests, 'off' in production,
    // otherwise 'fork' when Docker's socket is here. HERO_LOCAL_AGENT overrides.
    localAgent: localAgentOf(env, production),
    // One proxy hop: set TRUST_PROXY=1 behind a load balancer; Codespaces port forwarding is one (TRUST_PROXY=0 turns it off).
    trustProxy: env.TRUST_PROXY !== '0' && (env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true' || env.CODESPACES === 'true'),
    // The development sign-in (/dev/login, X-Dev-Person) and the development people: never in production.
    devSignIn: !production && env.DEV_SIGN_IN !== '0',
    cxTrackingSecret: env.CX_TRACKING_SECRET,
    sessionSecret: env.SESSION_SECRET,
    // GitHub OAuth app. Without it, outside production, GitHub sign-in uses the mock at /dev/github.
    github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    // Encrypts environment variables and GitHub tokens at rest (required in production; a dev key file otherwise).
    secretKey: env.HERO_SECRET_KEY,
  };
}
