import fs from 'node:fs';
import vm from 'node:vm';

const files = {
  html: 'index.html',
  css: 'assets/css/chatearn.css',
  app: 'assets/js/chatearn-app.js',
  ads: 'assets/js/chatearn-v4-2.js'
};
const failures=[];
const check=(condition,message)=>{console.log(`${condition?'PASS':'FAIL'}: ${message}`);if(!condition)failures.push(message);};
for(const path of Object.values(files))check(fs.existsSync(path),`${path} exists`);
const html=fs.readFileSync(files.html,'utf8');
const css=fs.readFileSync(files.css,'utf8');
const app=fs.readFileSync(files.app,'utf8');
const ads=fs.readFileSync(files.ads,'utf8');
for(const [name,code] of [['app',app],['ads',ads]]){try{new vm.Script(code,{filename:name});check(true,`${name} JavaScript parses`);}catch(error){check(false,`${name} JavaScript parses: ${error.message}`);}}
check(html.includes('Chat With <em>Foreigners</em>'),'original landing heading is present');
check(html.includes('Start Earning Now — Free'),'original primary CTA is present');
for(const id of ['landing','register','loading','dashboard','chat','earnings','withdraw','sharewall','kyc','processing'])check(html.includes(`id="${id}"`),`#${id} screen exists`);
check(css.includes('.land-hero')&&css.includes('.foreigner-card')&&css.includes('.chat-body'),'original visual system is present');
check(app.includes('FIRST_CYCLE_LIMIT = 80000'),'first-cycle limit is ₦80,000');
check(app.includes('MIN_WITHDRAW = 40000'),'withdrawal minimum is ₦40,000');
check(app.includes('REQUIRED_SHARES = 5'),'five-share flow is present');
check(app.includes('setTimeout(()=>openChat'),'automatic chat opening is present');
check(app.includes("client.auth.signUp")&&app.includes("client.auth.signInWithPassword"),'Supabase registration and login are present');
check(!app.includes(".from('")&&!app.includes('.rpc('),'Supabase is not used for balance, chat, withdrawal or ads');
check(app.includes("Automated chat partner"),'automated partner disclosure is present');
check(ads.includes('const ADS = [')&&ads.includes("theme:'green'")&&ads.includes("theme:'blue'")&&ads.includes("theme:'purple'")&&ads.includes("theme:'orange'"),'editable multi-style code ads are present');
check(!ads.includes('.rpc(')&&!ads.includes('.from('),'ads have no database dependency');
if(failures.length){console.error(`\n${failures.length} check(s) failed.`);process.exit(1);}console.log('\nOriginal design and complete flow checks passed.');
