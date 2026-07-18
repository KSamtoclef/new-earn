import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../index.html', import.meta.url);
const original = await readFile(path, 'utf8');
const anchor = '<script src="./assets/js/chatearn-v4-2.js?v=4.2.0" defer></script>';
const authFix = '<script src="./assets/js/chatearn-auth-session-fix.js?v=8.0.1" defer></script>';

if (original.includes(authFix)) {
  console.log('Auth/session fix is already installed.');
  process.exit(0);
}

const anchorCount = original.split(anchor).length - 1;
if (anchorCount !== 1) {
  throw new Error(`Expected exactly one V4.2 script anchor, found ${anchorCount}. No file was changed.`);
}

const updated = original.replace(anchor, `${anchor}\n${authFix}`);
if ((updated.split(authFix).length - 1) !== 1) {
  throw new Error('Auth/session fix reference count is not exactly one. No file was changed.');
}

await writeFile(path, updated, 'utf8');
console.log('Module 8 auth/session fix installed in index.html.');