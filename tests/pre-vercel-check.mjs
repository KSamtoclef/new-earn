import fs from 'node:fs';
import vm from 'node:vm';

const requiredFiles = [
  'index.html',
  'assets/css/app.css',
  'assets/js/config.js',
  'assets/js/app.js',
  'assets/js/auth.js',
  'assets/js/chat.js'
];

const forbiddenFiles = [
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
const expect = (condition, message) => condition ? pass(message) : fail(message);
const read = path => fs.readFileSync(path, 'utf8');

for (const path of requiredFiles) expect(fs.existsSync(path), `${path} exists`);
for (const path of forbiddenFiles) expect(!fs.existsSync(path), `${path} is removed`);

for (const path of requiredFiles.filter(path => path.endsWith('.js'))) {
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
const active = [config, app, auth, chat].join('\n');

expect(index.includes('Chat With <em>Foreigners</em>'), 'approved landing headline is present');
expect(index.includes('id="registerForm"') && index.includes('id="loginForm"'), 'registration and login forms exist');
expect(index.includes('id="partnerList"') && index.includes('id="messages"') && index.includes('id="composer"'), 'chat interface exists');
expect(index.includes('id="fixedAdSlot"') && index.includes('id="randomAdSlot"'), 'fixed and random ad slots exist');

const loadedModules = [...app.matchAll(/\.\/assets\/js\/([a-z0-9-]+\.js)/g)].map(match => match[1]);
expect(JSON.stringify(loadedModules) === JSON.stringify(['auth.js', 'chat.js']), 'runtime loads only auth and chat modules');
expect(!/\.from\s*\(/.test(active), 'active runtime contains no Supabase table queries');
expect(!/\.rpc\s*\(/.test(active), 'active runtime contains no Supabase RPC calls');
expect(auth.includes('client.auth.signUp'), 'Supabase registration is enabled');
expect(auth.includes('client.auth.signInWithPassword'), 'Supabase login is enabled');
expect(chat.includes("mode: 'fixed'") && chat.includes("mode: 'random'"), 'ads are managed directly in code');
expect(!active.includes('admin') && !active.includes('kyc_submissions') && !active.includes('withdrawals'), 'admin, KYC and withdrawal database logic are inactive');
expect(config.includes('cqnovqvmxwmfngupgtov'), 'current Supabase Auth project remains configured');

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll auth-only frontend checks passed.');