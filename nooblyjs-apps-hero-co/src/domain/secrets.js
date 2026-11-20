// Secrets at rest (product.md §3.7, roadmap 2.6): environment variable values and GitHub tokens are encrypted with
// AES-256-GCM before they reach the dataService, and never leave the server in an API answer except through an audited
// reveal. The key comes from HERO_SECRET_KEY (required in production); in development a random key is kept in
// <DATA_DIR>/secrets/dev-key.txt so restarts can still read what was written.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SALT = 'nooblyjs-cloud/secrets/v1';
export const MASK = '••••••';

/**
 * @param {{ dataDir: string, keyMaterial?: string, production?: boolean }} o
 */
export async function createSecrets({ dataDir, keyMaterial, production = false }) {
  if (!keyMaterial) {
    if (production) throw new Error('HERO_SECRET_KEY is required in production: environment variables and GitHub tokens are encrypted with it.');
    const file = path.join(dataDir, 'secrets', 'dev-key.txt');
    keyMaterial = (await fs.readFile(file, 'utf8').catch(() => '')).trim();
    if (!keyMaterial) {
      keyMaterial = crypto.randomBytes(32).toString('base64');
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, `${keyMaterial}\n`, { mode: 0o600 });
    }
  }
  const key = crypto.scryptSync(keyMaterial, SALT, 32);

  return {
    /** → "v1.<iv>.<tag>.<data>" (base64url); `context` binds the ciphertext to its record (it must match to open). */
    seal(value, context = '') {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(String(context)));
      const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
      return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
    },
    open(sealed, context = '') {
      const [v, iv, tag, data] = String(sealed ?? '').split('.');
      if (v !== 'v1' || !iv || !tag || data === undefined) throw new Error('Not a sealed value.');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(String(context)));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
    },
  };
}
