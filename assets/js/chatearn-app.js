(() => {
'use strict';

const SUPABASE_URL = 'https://cqnovqvmxwmfngupgtov.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbm92cXZteHdtZm5ndXBndG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODA0NzQsImV4cCI6MjA5OTg1NjQ3NH0.ZamXPTmqVsdHu1pD1EZLxPeSqWemBsj28Y1f-NOCEZs';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'chatearn-auth-v2' }
});

const SIGNUP_BONUS = 10000;
const MIN_WITHDRAW = 40000;
const FIRST_CYCLE_LIMIT = 80000;
const REQUIRED_SHARES = 5;
const SITE_LINKS = Object.freeze({
  primaryAd: '',
  secondaryAd: '',
  offerLink: '',
  kycLink: 'https://jikgykm.com/cl/a9f1535a330a2652'
});
window.SITE_LINKS = SITE_LINKS;
const SHARE_TEXT = `I’m earning on ChatEarn by completing rewarded chats. Join free: ${location.origin}`;
const NAV_KEY = 'chatearn_navigation_v1';

const PARTNERS = [
  { name:'alexlab102', flag:'🇺🇸', initials:'AL', country:'United States', rate:15000, color:'linear-gradient(135deg,#1565C0,#42A5F5)', messages:["Hey! 👋 I just got matched with you on here. I'm Alex. How is your day going?","Nice! Which part of Nigeria are you chatting from?","That sounds interesting. What do you enjoy most about where you live?","I’ve heard Nigerian music is amazing. What are you listening to lately?","That’s a good choice 😄 What do you do for work or school?","Respect. What do you usually do in your free time?","Would you ever like to visit the United States?","What is one thing people misunderstand about Nigeria?","I’ve enjoyed learning from you today.","Great chatting with you 😊"] },
  { name:'EmiliaCute', flag:'🇬🇧', initials:'EC', country:'United Kingdom', rate:12000, color:'linear-gradient(135deg,#880E4F,#F06292)', messages:["Hellooo 😊 I just got matched with you! How are you doing today?","Lovely! Where in Nigeria are you?","What is the weather like there today?","London has been rainy lately 😂","I have to ask—what is your favourite Nigerian meal?","That sounds delicious.","What kind of music do you enjoy?","Afrobeats is everywhere here now.","Would you ever visit London?","It was lovely chatting with you 😊"] },
  { name:'MattJohn', flag:'🇨🇦', initials:'MJ', country:'Canada', rate:10000, color:'linear-gradient(135deg,#1B5E20,#66BB6A)', messages:["Hey there! I’m Matt 👋 How are you?","Which part of Nigeria are you chatting from?","Toronto has a large Nigerian community too.","Do you have friends or family abroad?","What kind of work or study do you do?","That sounds cool.","What do you enjoy doing in your free time?","Afrobeats is everywhere here.","Would you ever want to visit Canada?","Great chatting with you 😊"] },
  { name:'Abi1990', flag:'🇺🇸', initials:'AB', country:'United States', rate:15000, color:'linear-gradient(135deg,#E65100,#FFA726)', messages:["Hey 😊 How’s your day?","Where in Nigeria are you from?","I’ve heard so much about Nigerian food and music.","What’s the best thing about your city?","Do you prefer staying home or going out?","What music are you listening to lately?","That’s a good choice 😄","What do you do for work or school?","Nigeria sounds full of energy.","I enjoyed this conversation 😊"] },
  { name:'princess77', flag:'🇩🇪', initials:'PR', country:'Germany', rate:8000, color:'linear-gradient(135deg,#4A148C,#CE93D8)', messages:["Hello 😊 Nice to meet you!","Which state are you from in Nigeria?","My friend talks about Nigeria all the time.","People here really enjoy Afrobeats now.","What is your favourite Nigerian meal?","I need to try that someday.","Do you get much time to relax?","What do you wish visitors understood about Nigeria?","Nigeria is on my travel list.","Thank you for the lovely chat 😊"] },
  { name:'CamilaAnders', flag:'🇦🇺', initials:'CA', country:'Australia', rate:10000, color:'linear-gradient(135deg,#006064,#4DD0E1)', messages:["G’day!! 😄 Are you really in Nigeria?","That’s so far from me! Which part are you in?","Nigeria is much bigger than people realise.","Australia has very different regions too.","What’s the vibe where you are?","Are you more of a city person?","Do you enjoy road trips?","Nigeria must have beautiful scenery.","Afrobeats is huge here now 🔥","Great talking with you 😄"] }
];

let authUser = null;
let currentPartner = null;
let busy = false;
let selectedBank = 'opay';
let currentScreen = 'landing';
let state = freshState();
let pendingShareAt = 0;

function freshState() {
  return { name:'User', balance:SIGNUP_BONUS, chatEarnings:0, replyCount:0, firstCycleComplete:false, withdrawal:null, shares:0, kycOpened:false, partnerTurns:{}, conversations:{} };
}
function storageKey() { return `chatearn_state_${authUser?.id || 'guest'}`; }
function loadState() {
  try { state = { ...freshState(), ...JSON.parse(localStorage.getItem(storageKey()) || '{}') }; } catch { state = freshState(); }
}
function saveState() { localStorage.setItem(storageKey(), JSON.stringify(state)); renderBalances(); }
function money(value) { return `₦${Number(value || 0).toLocaleString('en-NG')}`; }
function byId(id) { return document.getElementById(id); }
function notify(message, bad=false) {
  const toast = byId('toast'); if (!toast) return;
  toast.textContent = message; toast.className = bad ? 'toast show error' : 'toast show';
  clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.className = 'toast', 3000);
}
function navigationKey(){ return `${NAV_KEY}_${authUser?.id || 'guest'}`; }
function saveNavigation(){
  if(!authUser) return;
  localStorage.setItem(navigationKey(), JSON.stringify({screen:currentScreen,partner:currentPartner?.name||null}));
}
function goScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => { screen.classList.remove('active'); screen.style.display='none'; });
  const target = byId(id); if (!target) return;
  target.classList.add('active');
  target.style.display = ['loading','processing'].includes(id) ? 'flex' : 'block';
  if (['loading','processing'].includes(id)) Object.assign(target.style,{flexDirection:'column',alignItems:'center',justifyContent:'center'});
  currentScreen = id; saveNavigation(); scrollTo({top:0});
  if (id === 'dashboard') renderDashboard();
  if (id === 'earnings') renderEarnings();
  if (id === 'withdraw') renderWithdraw();
}
window.goScreen = goScreen;

function renderBalances() {
  const pairs = [['dashBalance',money(state.balance)],['earnPageAmount',Number(state.balance).toLocaleString('en-NG')],['chatEarnBreakdown',money(state.chatEarnings)],['totalEarnBreakdown',money(state.balance)],['wdAmount',money(state.balance)],['ppAmount',money(state.balance)]];
  pairs.forEach(([id,text]) => { const el=byId(id); if(el) el.textContent=text; });
  const teaser = byId('wdTeaserSub'), button = byId('wdTeaserBtn');
  if (teaser) teaser.textContent = state.balance >= MIN_WITHDRAW ? `${money(state.balance)} available for withdrawal` : `Minimum: ${money(MIN_WITHDRAW)} — Chat to unlock`;
  if (button) { button.textContent = state.balance >= MIN_WITHDRAW ? 'Withdraw →' : 'Locked 🔒'; button.disabled = state.balance < MIN_WITHDRAW; }
}
function renderDashboard() {
  if (byId('dashName')) byId('dashName').textContent = `Welcome, ${String(state.name||'User').split(' ')[0]}!`;
  renderBalances();
}
function renderEarnings() { renderBalances(); }
function renderWithdraw() { renderBalances(); }

function openLogin() { byId('loginModal')?.classList.add('show'); }
function closeLogin() { byId('loginModal')?.classList.remove('show'); }
window.openLogin=openLogin; window.closeLogin=closeLogin;

async function doRegister() {
  const name=byId('regName')?.value.trim(), email=byId('regEmail')?.value.trim(), password=byId('regPass')?.value||'';
  const errorBox=byId('regError');
  if (!name || !email || password.length < 6) return notify('Complete all fields correctly.',true);
  const button=byId('regSubmitBtn'); if(button){button.disabled=true;button.textContent='Creating account…';}
  try {
    const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:name}}});
    if(error) throw error;
    let session=data.session;
    if(!session){const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;session=login.data.session;}
    authUser=session?.user||data.user; if(!authUser) throw new Error('Account created but session could not start.');
    state=freshState(); state.name=name; saveState();
    runLoading(true);
  } catch(error) { if(errorBox) errorBox.textContent=error.message; notify(error.message||'Registration failed.',true); }
  finally { if(button){button.disabled=false;button.textContent='Create Account & Get ₦10,000 →';} }
}
window.doRegister=doRegister;

async function doLogin() {
  const email=byId('loginEmail')?.value.trim(), password=byId('loginPass')?.value||'', button=byId('loginBtn');
  if(button){button.disabled=true;button.textContent='Logging in…';}
  try {
    const {data,error}=await client.auth.signInWithPassword({email,password}); if(error)throw error;
    authUser=data.user; loadState(); state.name=state.name||authUser.user_metadata?.full_name||email.split('@')[0]; saveState(); closeLogin(); runLoading(false);
  } catch(error){const box=byId('loginError');if(box)box.textContent=error.message;notify(error.message||'Login failed.',true);}
  finally{if(button){button.disabled=false;button.textContent='Log In & Continue →';}}
}
window.doLogin=doLogin;
async function userLogout(){await client.auth.signOut();authUser=null;state=freshState();goScreen('landing');}
window.userLogout=userLogout;

function runLoading(isNew) {
  goScreen('loading');
  const title=byId('ldTitle'),sub=byId('ldSub'),fill=byId('ldFill');
  if(title)title.textContent=isNew?'Setting Up Your Account':'Welcome Back';
  if(sub)sub.textContent='Matching you with available conversations...';
  let progress=0; const timer=setInterval(()=>{progress+=20;if(fill)fill.style.width=`${progress}%`;if(progress>=100){clearInterval(timer);renderDashboard();goScreen('dashboard');setTimeout(()=>openChat(Math.floor(Math.random()*PARTNERS.length)),450);}},260);
}

function conversation(key){state.conversations[key] ||= [];return state.conversations[key];}
function addBubble(text,type,reward=0){
  const body=byId('chatBody'); if(!body)return;
  const wrap=document.createElement('div');wrap.className=`msg-row ${type==='user'?'mine':''}`;
  const bubble=document.createElement('div');bubble.className=`msg-bubble ${type==='user'?'msg-mine':'msg-theirs'}`;bubble.textContent=text;
  if(reward){const earn=document.createElement('div');earn.className='msg-earned';earn.textContent=`+${money(reward)} Earned`;bubble.appendChild(earn);}
  wrap.appendChild(bubble);body.appendChild(wrap);body.scrollTop=body.scrollHeight;
}
function renderConversation() {
  const body=byId('chatBody'); if(!body||!currentPartner)return; body.innerHTML='';
  const items=conversation(currentPartner.name);
  if(!items.length){const first=currentPartner.messages[0];items.push({type:'partner',text:first});saveState();}
  items.forEach(item=>addBubble(item.text,item.type,item.reward||0));
  renderQuickReplies(items.at(-1)?.text||'');
}
function renderQuickReplies(prompt) {
  const root=byId('quickReplies');if(!root)return;
  const lower=String(prompt).toLowerCase();let replies=['That’s interesting 😊','Tell me more','How about you?'];
  if(lower.includes('how are'))replies=['I’m good, thanks 😊','My day is going well','I’m fine. How about you?'];
  else if(lower.includes('where')||lower.includes('part of nigeria'))replies=['I’m from Lagos','I’m from Ogun State','I’m in Abuja'];
  else if(lower.includes('music'))replies=['I enjoy Afrobeats','Burna Boy is one of my favourites','What music do you like?'];
  else if(lower.includes('food')||lower.includes('meal'))replies=['I love jollof rice','You should try suya','What food do you enjoy?'];
  root.innerHTML=replies.map(text=>`<button type="button" onclick="useQuickReply(${JSON.stringify(text).replace(/"/g,'&quot;')})">${text}</button>`).join('');
}
function useQuickReply(text){if(byId('chatInput'))byId('chatInput').value=text;sendMsg();}
window.useQuickReply=useQuickReply;
function openChat(index) {
  currentPartner=PARTNERS[Number(index)]||PARTNERS[0];
  byId('chatName').textContent=currentPartner.name;byId('chatAv').textContent=currentPartner.flag;byId('chatEarnBadge').textContent=`+${money(currentPartner.rate)}/reply`;
  byId('chatStatus').textContent='🟢 Automated chat partner';
  renderConversation();goScreen('chat');setTimeout(()=>byId('chatInput')?.focus(),150);
}
window.openChat=openChat;
function handleEnter(event){if(event.key==='Enter'){event.preventDefault();sendMsg();}}
window.handleEnter=handleEnter;
async function sendMsg() {
  if(busy||!currentPartner)return;const input=byId('chatInput'),text=input?.value.trim();if(!text)return;
  if(!state.firstCycleComplete&&state.balance>=FIRST_CYCLE_LIMIT){notify(`You reached your first earning limit of ${money(FIRST_CYCLE_LIMIT)}. Withdraw to continue.`,true);goScreen('earnings');return;}
  busy=true;input.disabled=true;input.value='';
  const items=conversation(currentPartner.name);items.push({type:'user',text});addBubble(text,'user');
  const reward=Math.min(currentPartner.rate,state.firstCycleComplete?currentPartner.rate:Math.max(0,FIRST_CYCLE_LIMIT-state.balance));
  state.balance+=reward;state.chatEarnings+=reward;state.replyCount+=1;items[items.length-1].reward=reward;saveState();renderConversation();
  if(state.balance>=FIRST_CYCLE_LIMIT&&!state.firstCycleComplete){notify(`First earning cycle reached ${money(FIRST_CYCLE_LIMIT)}.`);setTimeout(()=>goScreen('earnings'),900);busy=false;input.disabled=false;return;}
  const turn=(state.partnerTurns[currentPartner.name]||0)+1;state.partnerTurns[currentPartner.name]=turn;saveState();
  setTimeout(()=>{const reply=currentPartner.messages[Math.min(turn,currentPartner.messages.length-1)];items.push({type:'partner',text:reply});saveState();addBubble(reply,'partner');renderQuickReplies(reply);busy=false;input.disabled=false;input.focus();window.ChatEarnAds?.afterReply?.(state.replyCount,byId('chatBody'));},700);
}
window.sendMsg=sendMsg;

function tryWithdraw(){if(state.balance<MIN_WITHDRAW)return notify(`${money(MIN_WITHDRAW-state.balance)} remaining before withdrawal.`,true);goScreen('earnings');}
window.tryWithdraw=tryWithdraw;
function selectBank(bank){selectedBank=bank;byId('bankOpay')?.classList.toggle('selected',bank==='opay');byId('bankPalmpay')?.classList.toggle('selected',bank==='palmpay');}
window.selectBank=selectBank;
function triggerBankVerify(value){const box=byId('bankVerifyStatus');if(!box)return;if(String(value).length===10){box.style.display='block';box.style.background='rgba(0,200,83,.08)';box.style.color='#69F0AE';box.textContent='✓ Account number format accepted';}else box.style.display='none';}
window.triggerBankVerify=triggerBankVerify;
function placeWithdrawal(){
  const number=String(byId('wdAccNo')?.value||''),name=byId('wdAccName')?.value.trim();
  if(number.length!==10||!name)return notify('Enter a valid 10-digit account number and account name.',true);
  state.withdrawal={amount:state.balance,bank:selectedBank,accountNumber:number,accountName:name,status:'verification',submittedAt:new Date().toISOString()};saveState();goScreen('sharewall');renderShare();
}
window.placeWithdrawal=placeWithdrawal;
function renderShare(){const pct=Math.min(100,Math.round(state.shares/REQUIRED_SHARES*100));if(byId('swPct'))byId('swPct').textContent=`${pct}%`;if(byId('swFill'))byId('swFill').style.width=`${pct}%`;if(byId('swStatus'))byId('swStatus').textContent=state.shares>=REQUIRED_SHARES?'Verification complete':`${REQUIRED_SHARES-state.shares} shares remaining`;if(byId('swBtnText'))byId('swBtnText').textContent=state.shares>=REQUIRED_SHARES?'Continue to KYC':'Share on WhatsApp to Verify';}
function doShareWA(){if(state.shares>=REQUIRED_SHARES){goScreen('kyc');return;}pendingShareAt=Date.now();window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_TEXT)}`,'_blank','noopener,noreferrer');}
window.doShareWA=doShareWA;
function verifyShareReturn(){if(!pendingShareAt||document.hidden||Date.now()-pendingShareAt<1200)return;pendingShareAt=0;state.shares=Math.min(REQUIRED_SHARES,state.shares+1);saveState();renderShare();if(state.shares>=REQUIRED_SHARES)setTimeout(()=>goScreen('kyc'),500);}
document.addEventListener('visibilitychange',verifyShareReturn);window.addEventListener('pageshow',verifyShareReturn);
function doKYC(){
  if(!state.kycOpened){state.kycOpened=true;saveState();window.open(SITE_LINKS.kycLink,'_blank','noopener,noreferrer');const button=document.querySelector('.btn-complete-kyc');if(button)button.textContent='I Have Completed KYC — Continue';return;}
  state.withdrawal={...state.withdrawal,status:'processing'};state.firstCycleComplete=true;saveState();
  if(byId('ppBank'))byId('ppBank').textContent=selectedBank==='opay'?'OPay':'PalmPay';if(byId('ppRef'))byId('ppRef').textContent=`CE-${Date.now().toString().slice(-8)}`;goScreen('processing');
}
window.doKYC=doKYC;
function shareAgain(){window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_TEXT)}`,'_blank','noopener,noreferrer');}
window.shareAgain=shareAgain;
function claimStreak(){byId('streakModal').style.display='none';}
window.claimStreak=claimStreak;
function showBackWarn(){byId('bwAmount').textContent=money(state.balance);byId('backWarn')?.classList.add('show');}
function closeBackWarn(){byId('backWarn')?.classList.remove('show');}
window.closeBackWarn=closeBackWarn;
function trackClick(){return true;}window.trackClick=trackClick;

async function boot(){
  document.querySelector('.admin-shell')?.remove();
  const {data}=await client.auth.getSession();authUser=data.session?.user||null;
  if(authUser){
    loadState();state.name=state.name||authUser.user_metadata?.full_name||authUser.email?.split('@')[0]||'User';saveState();
    let saved={};try{saved=JSON.parse(localStorage.getItem(navigationKey())||'{}')}catch{}
    const allowed=new Set(['dashboard','chat','earnings','withdraw','sharewall','kyc','processing']);
    if(saved.screen==='chat'&&saved.partner){const idx=PARTNERS.findIndex(p=>p.name===saved.partner);openChat(idx>=0?idx:0);}
    else {const screen=allowed.has(saved.screen)?saved.screen:'dashboard';goScreen(screen);if(screen==='sharewall')renderShare();}
  } else goScreen('landing');
  renderBalances();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();