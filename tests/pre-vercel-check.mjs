import fs from 'node:fs';
import vm from 'node:vm';

const requiredFiles = [
  'index.html',
  'assets/js/config.js',
  'assets/js/app.js',
  'assets/js/auth.js',
  'assets/js/chat.js',
  'assets/js/rewards.js',
  'assets/js/withdrawal.js',
  'assets/js/content.js',
  'assets/js/admin.js',
  'assets/js/stabilization.js',
  'assets/js/admin-metrics.js'
];

const failures = [];
const pass = message => console.log(`PASS: ${message}`);
const fail = message => { failures.push(message); console.error(`FAIL: ${message}`); };
const read = path => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => condition ? pass(message) : fail(message);

for (const path of requiredFiles) expect(fs.existsSync(path), `${path} exists`);

for (const path of requiredFiles.filter(path => path.endsWith('.js'))) {
  if (!fs.existsSync(path)) continue;
  try {
    new vm.Script(read(path), { filename: path });
    pass(`${path} has valid JavaScript syntax`);
  } catch (error) {
    fail(`${path} syntax error: ${error.message}`);
  }
}

const index = read('index.html');
const config = read('assets/js/config.js');
const app = read('assets/js/app.js');
const auth = read('assets/js/auth.js');
const chat = read('assets/js/chat.js');
const rewards = read('assets/js/rewards.js');
const withdrawal = read('assets/js/withdrawal.js');
const content = read('assets/js/content.js');
const admin = read('assets/js/admin.js');
const stabilization = read('assets/js/stabilization.js');
const adminMetrics = read('assets/js/admin-metrics.js');

expect(index.includes('./assets/js/config.js') && index.includes('./assets/js/app.js'), 'index loads canonical config and app entrypoints');
expect(!config.includes('chat.js'), 'config does not load chat directly');

const loadedModules = [...app.matchAll(/\.\/assets\/js\/([a-z0-9-]+\.js)/g)].map(match => match[1]);
expect(new Set(loadedModules).size === loadedModules.length, 'app loader contains no duplicate modules');
for (const module of ['auth.js','chat.js','rewards.js','withdrawal.js','content.js','admin.js','stabilization.js','admin-metrics.js']) {
  expect(loadedModules.includes(module), `app loader includes ${module}`);
}

const allActive = [config, app, auth, chat, rewards, withdrawal, content, admin, stabilization, adminMetrics].join('\n');
for (const legacy of ['chatearn-v3.js','chatearn-v4-returning.js','chatearn-v4-2.js','chatearn-module7-admin.js','dtjxcgzpwemdgdeinkcl']) {
  expect(!allActive.includes(legacy), `no active reference to ${legacy}`);
}
expect(config.includes('cqnovqvmxwmfngupgtov'), 'canonical Supabase project is configured');

for (const rpc of [
  'chatearn_send_message',
  'chatearn_request_withdrawal',
  'chatearn_record_share_attempt',
  'chatearn_create_kyc_request',
  'chatearn_get_chat_task_config',
  'chatearn_v4_get_unique_offer',
  'chatearn_v3_track_offer_event',
  'chatearn_v3_admin_is_admin',
  'chatearn_v6_admin_save_offer',
  'chatearn_v6_admin_save_task'
]) {
  expect(allActive.includes(rpc), `required RPC ${rpc} is referenced`);
}

for (const id of ['landing','register','login','loading','dashboard','toast']) expect(index.includes(`id="${id}"`), `index contains #${id}`);
for (const id of ['chat','messages','composer']) expect(chat.includes(`id="${id}"`), `chat builds #${id}`);
for (const id of ['withdraw','sharewall','kyc','processing']) expect(withdrawal.includes(`id="${id}"`), `withdrawal builds #${id}`);

expect(rewards.includes('40000'), 'withdrawal minimum is ₦40,000');
expect(stabilization.includes('FIRST_LIMIT = 80000'), 'first-cycle earning lock is ₦80,000');
expect(stabilization.includes('ACTIVE_WITHDRAWALS'), 'duplicate withdrawal guard is present');
expect(stabilization.includes('verifyShareReturn'), 'return-based share verification is present');
expect(stabilization.includes("document.addEventListener('click',shareGuard,true)"), 'share guard runs before the original click handler');
expect(stabilization.includes('latestKyc'), 'KYC database verification is present');
expect(stabilization.includes('continueGuard'), 'server-aware continue earning guard is present');
expect(stabilization.includes('data-offer-action="edit"') && stabilization.includes('data-offer-action="toggle"') && stabilization.includes('data-offer-action="delete"'), 'admin ad edit, pause/resume and delete controls exist');
expect(adminMetrics.includes('views') && adminMetrics.includes('clicks'), 'admin campaign metrics include views and clicks');
expect(!withdrawal.includes('Account Verified'), 'withdrawal UI does not fake bank verification');

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll pre-Vercel repository checks passed.');
