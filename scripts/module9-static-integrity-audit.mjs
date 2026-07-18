#!/usr/bin/env node

/**
 * ChatEarn Module 9 — static integrity audit.
 *
 * Read-only checks only. This script does not modify repository files.
 */

import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import process from 'node:process';

const requiredFiles = [
  'index.html',
  'assets/js/chatearn-app.js',
  'assets/js/chatearn-v3.js',
  'assets/js/chatearn-v4-returning.js',
  'assets/js/chatearn-v4-2.js',
  'assets/js/chatearn-v6-admin.js',
  'assets/js/chatearn-v7-admin-withdrawals.js',
  'assets/js/chatearn-v7-admin-kyc.js',
  'assets/js/chatearn-module7-admin.js'
];

const checks = [];
const add = (name, passed, detail) => checks.push({ name, passed, detail });

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

for (const path of requiredFiles) {
  add(`required file: ${path}`, await exists(path), path);
}

const index = await readFile('index.html', 'utf8');
const coordinator = await readFile('assets/js/chatearn-module7-admin.js', 'utf8');
const withdrawals = await readFile('assets/js/chatearn-v7-admin-withdrawals.js', 'utf8');
const kyc = await readFile('assets/js/chatearn-v7-admin-kyc.js', 'utf8');
const returning = await readFile('assets/js/chatearn-v4-returning.js', 'utf8');

add(
  'index has one active Module 7 loading route',
  Number(index.includes('chatearn-module7-admin.js')) + Number(index.includes('chatearn-v6-2-3-final.js')) === 1,
  'Exactly one canonical or compatibility Module 7 entrypoint must be referenced.'
);

add(
  'retired reward JS is not loaded',
  !index.includes('chatearn-v6-2-rewards.js') && !index.includes('chatearn-v6-2-5-final.js'),
  'Historical reward scripts must remain absent from index.html.'
);

add(
  'coordinator loads withdrawal admin',
  coordinator.includes('chatearn-v7-admin-withdrawals.js'),
  'Module 7 coordinator must load canonical withdrawal admin.'
);

add(
  'coordinator loads KYC admin',
  coordinator.includes('chatearn-v7-admin-kyc.js'),
  'Module 7 coordinator must load canonical KYC admin.'
);

add(
  'withdrawal admin uses canonical list RPC',
  withdrawals.includes('chatearn_admin_list_withdrawals_v5'),
  'Canonical withdrawal list RPC must be present.'
);

add(
  'withdrawal admin uses canonical transition RPC',
  withdrawals.includes('chatearn_admin_transition_withdrawal_v5'),
  'Canonical withdrawal transition RPC must be present.'
);

add(
  'withdrawal admin has no direct table mutation',
  !/\.from\s*\(\s*['"](?:withdrawals|wallets|profiles)['"]\s*\)\s*\.\s*(?:insert|update|delete|upsert)\s*\(/.test(withdrawals),
  'Financial admin actions must pass through protected RPCs.'
);

add(
  'KYC admin uses protected queue RPC',
  kyc.includes('chatearn_v6_admin_queue'),
  'KYC records must be loaded through the existing admin RPC boundary.'
);

add(
  'KYC admin uses protected review RPC',
  kyc.includes('chatearn_v6_admin_bulk_review'),
  'KYC decisions must use the protected review RPC.'
);

add(
  'KYC admin has no direct table mutation',
  !/\.from\s*\([^)]*\)\s*\.\s*(?:insert|update|delete|upsert)\s*\(/.test(kyc),
  'KYC admin must not directly mutate Supabase tables.'
);

for (const rpc of [
  'chatearn_get_withdrawal_portal_v5',
  'chatearn_get_payout_accounts_v5',
  'chatearn_submit_withdrawal_v5'
]) {
  add(`returning-user withdrawal RPC: ${rpc}`, returning.includes(rpc), rpc);
}

const failed = checks.filter(check => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.name}`);
  if (!check.passed) console.log(`      ${check.detail}`);
}

console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);

if (failed.length) {
  console.error('Module 9 static integrity audit failed.');
  process.exitCode = 1;
} else {
  console.log('Module 9 static integrity audit passed.');
}
