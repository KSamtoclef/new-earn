import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../index.html', import.meta.url);
const original = await readFile(path, 'utf8');

const oldCss = '<link rel="stylesheet" href="./assets/css/chatearn-v6-2-rewards.css?v=6.2.3">';
const oldJs = '<script src="./assets/js/chatearn-v6-2-3-final.js?v=6.2.5" defer></script>';
const newJs = '<script src="./assets/js/chatearn-module7-admin.js?v=8.1.0" defer></script>';

for (const required of [oldCss, oldJs]) {
  const count = original.split(required).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one occurrence of ${required}, found ${count}. No file was changed.`);
  }
}

if (original.includes(newJs)) {
  throw new Error('Canonical Module 7 coordinator is already referenced. No file was changed.');
}

const updated = original
  .replace(`${oldCss}\n`, '')
  .replace(oldJs, newJs);

if (updated.length >= original.length) {
  throw new Error('Unexpected index transformation result. No file was changed.');
}
if (updated.includes('chatearn-v6-2-rewards.css')) {
  throw new Error('Legacy reward CSS reference remains. No file was changed.');
}
if (updated.includes('chatearn-v6-2-3-final.js')) {
  throw new Error('Legacy compatibility JavaScript reference remains. No file was changed.');
}
if ((updated.split(newJs).length - 1) !== 1) {
  throw new Error('Canonical coordinator reference count is not exactly one. No file was changed.');
}

await writeFile(path, updated, 'utf8');
console.log('Module 8C index cleanup completed safely.');
