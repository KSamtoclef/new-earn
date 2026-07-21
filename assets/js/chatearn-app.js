(()=>{'use strict';

const SUPABASE_URL='https://cqnovqvmxwmfngupgtov.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbm92cXZteHdtZm5ndXBndG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODA0NzQsImV4cCI6MjA5OTg1NjQ3NH0.ZamXPTmqVsdHu1pD1EZLxPeSqWemBsj28Y1f-NOCEZs';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'ce-auth-v6'}});

const SIGNUP_BONUS=10000;
const FIRST_WITHDRAWAL_THRESHOLD=60000;
const REQUIRED_SHARE_ACTIONS=5;
const SHARE_COOLDOWN_MS=5000;
const KYC_CONFIG={url:'https://omg10/11279843',active:true};
const AD_CONFIG={
 inlineChat:[{id:'inline_chat_1',title:'Sponsored Reward',description:'Explore today’s featured opportunity.',buttonText:'VIEW OPPORTUNITY',url:'PASTE_INLINE_CHAT_AD_URL_HERE',active:true,minimumMessages:3,maximumShowsPerSession:1,cooldownMinutes:20}],
 partnerList:[{id:'partner_list_1',title:'Featured Opportunity',description:'See today’s sponsored opportunity.',buttonText:'OPEN',url:'PASTE_PARTNER_LIST_AD_URL_HERE',active:true}],
 buttonAds:[{id:'button_ad_1',title:'Sponsored Opportunity',buttonText:'VIEW SPONSORED OFFER',url:'PASTE_BUTTON_AD_URL_HERE',active:true}],
 halfScreen:[{id:'half_screen_1',title:'Sponsored Reward',description:'Explore this featured opportunity.',buttonText:'VIEW OPPORTUNITY',url:'PASTE_HALF_SCREEN_AD_URL_HERE',active:true,maximumShowsPerSession:1}],
 earnings:[{id:'earnings_ad_1',title:'Earnings Opportunity',description:'Explore today’s sponsored reward.',buttonText:'OPEN OPPORTUNITY',url:'PASTE_EARNINGS_AD_URL_HERE',active:true}]
};
window.CHATEARN_CONFIG=Object.freeze({FIRST_WITHDRAWAL_THRESHOLD,REQUIRED_SHARE_ACTIONS,KYC_CONFIG,AD_CONFIG,contextualCombinations:512});

const PARTNERS=[
{name:'alexlab102',initials:'AL',flag:'🇺🇸',country:'United States',language:'English',rate:7000,opening:'Hey! 👋 I just got matched with you. How is your day going?',branches:[
 {match:['good','well','fine'],reply:'Nice 😊 Which part of Nigeria are you chatting from?',suggestions:['I’m from Lagos','I’m from Ogun State','I’m in Abuja']},
 {match:['lagos'],reply:'Lagos sounds lively! What do you enjoy most about living there?',suggestions:['The energy is amazing','I enjoy the opportunities','The food and music']},
 {match:['ogun'],reply:'Nice 😊 What do you enjoy most about living in Ogun State?',suggestions:['It is peaceful','I like the community','School keeps me busy']},
 {match:['abuja'],reply:'Abuja looks beautiful in photos. What is your favourite place there?',suggestions:['The city centre','The parks','I’m still exploring']},
 {match:['music','afrobeats','burna'],reply:'Afrobeats has become huge here. Who is your favourite artist?',suggestions:['Burna Boy','Davido','Wizkid']},
 {match:[],reply:'That’s interesting 😊 Tell me a little more about yourself.',suggestions:['I’m a student','I work online','I enjoy learning new things']}
]},
{name:'EmiliaCute',initials:'EC',flag:'🇬🇧',country:'United Kingdom',language:'English',rate:6000,opening:'Hellooo 😊 I just got matched with you! How are you doing today?',branches:[
 {match:['good','fine','well'],reply:'Lovely! Where in Nigeria are you?',suggestions:['Lagos','Ogun State','Abuja']},
 {match:['lagos','ogun','abuja'],reply:'What is the weather like there today?',suggestions:['It is sunny','It is raining','It is quite warm']},
 {match:['sunny','raining','warm'],reply:'London has been unpredictable lately 😂 What is your favourite Nigerian meal?',suggestions:['Jollof rice','Pounded yam','Suya']},
 {match:['jollof','pounded','suya'],reply:'That sounds delicious. What music do you enjoy?',suggestions:['Afrobeats','Gospel music','A mix of everything']},
 {match:[],reply:'That sounds interesting 😊 What do you enjoy doing in your free time?',suggestions:['Watching movies','Learning online','Spending time with friends']}
]},
{name:'MattJohn',initials:'MJ',flag:'🇨🇦',country:'Canada',language:'English',rate:5000,opening:'Hey there! I’m Matt 👋 How are you?',branches:[
 {match:['good','fine','well'],reply:'Which part of Nigeria are you chatting from?',suggestions:['Lagos','Ogun State','Abuja']},
 {match:['lagos','ogun','abuja'],reply:'What kind of work or study do you do?',suggestions:['I study computer science','I work online','I’m learning digital skills']},
 {match:['computer','online','digital'],reply:'That sounds cool. What do you enjoy most about it?',suggestions:['Solving problems','Building things','Learning new skills']},
 {match:[],reply:'Would you ever want to visit Canada?',suggestions:['Yes, definitely','Maybe someday','I would love to visit']}
]},
{name:'Abi1990',initials:'AB',flag:'🇺🇸',country:'United States',language:'English',rate:8000,opening:'Hey 😊 How’s your day?',branches:[
 {match:['good','fine','well'],reply:'Where in Nigeria are you from?',suggestions:['Lagos','Ogun State','Abuja']},
 {match:['lagos','ogun','abuja'],reply:'What’s the best thing about your city?',suggestions:['The people','The opportunities','The food and culture']},
 {match:['people','opportunities','food','culture'],reply:'Nice 😄 What music are you listening to lately?',suggestions:['Afrobeats','Gospel','Hip-hop']},
 {match:[],reply:'That’s a good choice 😊 What do you do for work or school?',suggestions:['I’m a student','I work online','I’m building a business']}
]},
{name:'princess77',initials:'PR',flag:'🇩🇪',country:'Germany',language:'English',rate:5000,opening:'Hello 😊 Nice to meet you!',branches:[
 {match:['hello','hi','nice'],reply:'Which state are you from in Nigeria?',suggestions:['Lagos','Ogun State','Abuja']},
 {match:['lagos','ogun','abuja'],reply:'What is your favourite Nigerian meal?',suggestions:['Jollof rice','Amala','Egusi soup']},
 {match:['jollof','amala','egusi'],reply:'I need to try that someday. Do you get much time to relax?',suggestions:['Sometimes','Not really','Mostly on weekends']},
 {match:[],reply:'What do you wish visitors understood about Nigeria?',suggestions:['The people are welcoming','Nigeria is very diverse','There is a lot of creativity']}
]},
{name:'CamilaAnders',initials:'CA',flag:'🇦🇺',country:'Australia',language:'English',rate:6000,opening:'G’day!! 😄 Are you really in Nigeria?',branches:[
 {match:['yes','nigeria'],reply:'That’s so far from me! Which part are you in?',suggestions:['Lagos','Ogun State','Abuja']},
 {match:['lagos','ogun','abuja'],reply:'What’s the vibe where you are?',suggestions:['Busy and energetic','Calm and friendly','A mix of both']},
 {match:['busy','calm','mix'],reply:'Do you enjoy road trips?',suggestions:['Yes, I love them','Sometimes','I prefer staying close to home']},
 {match:[],reply:'Nigeria must have beautiful scenery. What place would you recommend?',suggestions:['Lagos beaches','Olumo Rock','Abuja city']}
]},
{name:'SophiaWave',initials:'SW',flag:'🇿🇦',country:'South Africa',language:'English',rate:6000,opening:'Hi 😊 I’m available for a chat. How has your week been?',branches:[
 {match:['good','fine','busy'],reply:'What has kept you busiest this week?',suggestions:['School','Work','Personal projects']},
 {match:['school','work','project'],reply:'That sounds productive. What are you hoping to achieve next?',suggestions:['Finish an important task','Learn a new skill','Take some rest']},
 {match:[],reply:'What is one thing you are looking forward to?',suggestions:['A new opportunity','Finishing school','Growing my skills']}
]},
{name:'DanielConnect',initials:'DC',flag:'🇰🇪',country:'Kenya',language:'English',rate:5000,opening:'Hello from Kenya 👋 What are you working on today?',branches:[
 {match:['school','work','project','business'],reply:'Nice. What part of it do you enjoy most?',suggestions:['The creativity','The challenge','Seeing progress']},
 {match:[],reply:'What digital skill would you like to improve?',suggestions:['Web development','Design','Digital marketing']}
]}
];

const PERSONALITY_OPENERS=[
 'That makes sense 😊','Interesting — thanks for sharing.','Nice, I understand.','That sounds good.','I like that answer.','Good point.','Thanks for explaining.','I can relate to that.'
];
const CONTEXT_LIBRARY=[
 {keys:['school','student','university','course','study'],questions:['What part of your studies interests you most?','What subject has challenged you recently?','What skill are you building through school?','What would make this school year successful for you?'],suggestions:['I enjoy practical projects','Some courses are challenging','I want to improve my skills','Finishing well is my goal']},
 {keys:['work','job','business','online'],questions:['What part of your work do you enjoy most?','What are you currently trying to improve?','What kind of opportunity are you looking for?','What keeps you motivated when work gets difficult?'],suggestions:['I enjoy solving problems','I’m building something new','I want more opportunities','Progress keeps me motivated']},
 {keys:['music','song','artist','afrobeats'],questions:['Which artist have you played most lately?','What kind of song improves your mood?','Do you prefer calm music or energetic music?','What Nigerian song would you recommend?'],suggestions:['I listen to Afrobeats','Gospel lifts my mood','I enjoy energetic songs','I have several favourites']},
 {keys:['food','meal','rice','suya','jollof','amala','egusi'],questions:['What meal could you eat every week?','Do you prefer cooking or buying food?','What Nigerian meal should a visitor try first?','Is there a food you are learning to prepare?'],suggestions:['Jollof rice is a favourite','I enjoy local meals','Suya is a good choice','I like trying new food']},
 {keys:['lagos','ogun','abuja','nigeria','city','state'],questions:['What do you enjoy most about where you live?','What would you show a first-time visitor?','Is your area usually calm or busy?','What makes your city feel like home?'],suggestions:['The people are welcoming','There are many opportunities','It is usually lively','The community feels familiar']},
 {keys:['travel','visit','canada','london','america','australia'],questions:['Which country would you most like to visit?','What would you want to experience there first?','Do you prefer city trips or nature trips?','Who would you like to travel with?'],suggestions:['I would explore the city','I want to experience the culture','Nature trips sound relaxing','I would travel with family']},
 {keys:['movie','film','series','watch'],questions:['What kind of movies do you enjoy?','Have you watched anything memorable recently?','Do you prefer comedy or action?','Would you rather watch at home or at the cinema?'],suggestions:['I enjoy comedy','Action movies are fun','I watch at home mostly','I like interesting series']},
 {keys:['weekend','free time','relax','rest'],questions:['What is your ideal way to relax?','How do you usually spend weekends?','What helps you reset after a busy day?','Do you prefer quiet time or going out?'],suggestions:['I listen to music','I spend time with friends','I enjoy quiet time','I catch up on sleep']},
 {keys:['technology','computer','coding','digital','design'],questions:['Which digital skill interests you most?','What would you like to build with technology?','Do you learn better through videos or practice?','What technology topic are you exploring now?'],suggestions:['Web development interests me','I enjoy design','Practice helps me learn','I want to build useful tools']},
 {keys:['family','friend','people','community'],questions:['What do you value most in friendship?','Who encourages you when things are difficult?','Do you enjoy large gatherings or small groups?','What makes a community feel supportive?'],suggestions:['Honesty matters to me','My family encourages me','I prefer small groups','People helping each other matters']},
 {keys:['goal','future','dream','plan'],questions:['What goal are you focused on right now?','What would you like to achieve this year?','What is one small step you can take next?','What kind of future are you working toward?'],suggestions:['I want to grow my skills','I’m focused on school','I want to build a business','Consistency is my next step']},
 {keys:['money','earn','income','finance'],questions:['What financial goal matters most to you?','Do you prefer saving first or investing in skills?','What would extra income help you achieve?','What money habit are you trying to improve?'],suggestions:['I want to save more','I invest in learning','Extra income would help with school','I’m improving my budgeting']},
 {keys:['weather','rain','sunny','warm'],questions:['Do you enjoy rainy or sunny days more?','What weather helps you feel productive?','What do you usually do when it rains?','Is the weather different from last week?'],suggestions:['I prefer sunny days','Rain helps me relax','I stay indoors when it rains','It has been warmer lately']},
 {keys:['sport','football','game','team'],questions:['What sport do you enjoy watching or playing?','Do you support a particular team?','Would you rather play or watch?','What makes a game exciting for you?'],suggestions:['I enjoy football','I like competitive games','I prefer watching','A close match is exciting']},
 {keys:['good','fine','well','happy'],questions:['What has made your day feel good?','What are you looking forward to today?','Has anything interesting happened recently?','What would make today even better?'],suggestions:['I completed something important','I’m looking forward to resting','My day has been peaceful','Good news would make it better']},
 {keys:[],questions:['What is something you have been thinking about lately?','What topic could you talk about for hours?','What is one thing you would like to improve?','What has been the best part of your week?'],suggestions:['I’m focused on my goals','I enjoy learning new things','I want to improve my skills','This week has been productive']}
];
function contextualResponse(text){
 const normalized=String(text||'').toLowerCase();
 const topic=CONTEXT_LIBRARY.find(item=>item.keys.some(key=>normalized.includes(key)))||CONTEXT_LIBRARY.at(-1);
 const turn=Number(state.partnerTurns[currentPartner?.name]||0);
 const variant=turn%topic.questions.length;
 const tone=PERSONALITY_OPENERS[(turn+(currentPartner?.name?.length||0))%PERSONALITY_OPENERS.length];
 const suggestionStart=(variant+turn)%topic.suggestions.length;
 const picks=[0,1,2].map(offset=>topic.suggestions[(suggestionStart+offset)%topic.suggestions.length]);
 return{reply:`${tone} ${topic.questions[variant]}`,suggestions:picks};
}

let authUser=null,currentPartner=null,currentScreen='landing',busy=false,selectedBank='opay',state=freshState();
let shareReturnTimer=null;

const $=id=>document.getElementById(id);
const money=n=>`₦${Number(n||0).toLocaleString('en-NG')}`;
const nowISO=()=>new Date().toISOString();
const stamp=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const validUrl=url=>Boolean(url&&!url.includes('PASTE_')&&/^https?:\/\//i.test(url));

function freshState(){return{
 name:'User',bonusCredited:false,totalBalance:0,chatEarnings:0,sponsoredEarnings:0,lifetimeEarnings:0,
 amountUnderReview:0,newEarnings:0,availableBalance:0,withdrawal:null,sharing:{count:0,pending:false,openedAt:null,returnedAt:null,cooldownUntil:0,events:[]},
 kyc:{status:'not_started',openedAt:null,returnedAt:null,withdrawalId:null},paymentStatus:'not_started',
 lastPartner:null,partnerTurns:{},conversations:{},rewardedMessageIds:{},lastRewardText:'',lastRewardAt:0,
 referralCode:'',unlockShown:false,ad:{replyCounter:0,nextInterval:randomInterval(),shown:{},lastAdId:null,events:[]}
}}
function storageKey(){return`ce-state-${authUser?.id||'guest'}`}
function navKey(){return`ce-nav-${authUser?.id||'guest'}`}
function loadState(){
 try{state={...freshState(),...JSON.parse(localStorage.getItem(storageKey())||'')}}catch{state=freshState()}
 state.sharing={...freshState().sharing,...(state.sharing||{})};
 state.kyc={...freshState().kyc,...(state.kyc||{})};
 state.ad={...freshState().ad,...(state.ad||{})};
 if(!state.referralCode)state.referralCode=`CE${(authUser?.id||crypto.randomUUID()).replaceAll('-','').slice(0,8).toUpperCase()}`;
 syncBalances();
}
function saveState(){
 syncBalances();
 localStorage.setItem(storageKey(),JSON.stringify(state));
 localStorage.setItem(navKey(),JSON.stringify({screen:currentScreen,partner:currentPartner?.name||state.lastPartner}));
 renderBalances();
}
function syncBalances(){
 const requested=Number(state.amountUnderReview||state.withdrawal?.amount||0);
 const lifetime=SIGNUP_BONUS*(state.bonusCredited?1:0)+Number(state.chatEarnings||0)+Number(state.sponsoredEarnings||0);
 state.lifetimeEarnings=Math.max(Number(state.lifetimeEarnings||0),lifetime);
 state.newEarnings=Math.max(0,state.lifetimeEarnings-requested);
 state.availableBalance=state.withdrawal?state.newEarnings:state.lifetimeEarnings;
 state.totalBalance=state.availableBalance;
}
function creditSignupOnce(){if(state.bonusCredited)return;state.bonusCredited=true;state.lifetimeEarnings+=SIGNUP_BONUS;saveState()}
function toast(text,bad=false){const e=$('toast');if(!e)return;e.textContent=text;e.className=bad?'toast show error':'toast show';clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='toast',3000)}
function esc(text){const d=document.createElement('div');d.textContent=String(text);return d.innerHTML}
function randomInterval(){return 3+Math.floor(Math.random()*3)}
function transactionId(){return`CHAT-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`}

function showScreen(id){
 document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='none'});
 const target=$(id);if(!target)return;
 target.classList.add('active');target.style.display=['loading','processing'].includes(id)?'flex':'block';
 currentScreen=id;
 if(id==='dashboard')renderDashboard();
 if(id==='earnings')renderEarnings();
 if(id==='withdraw')renderWithdraw();
 if(id==='sharewall')renderShare();
 if(id==='kyc')renderKYC();
 if(id==='processing')renderProcessing();
 saveState();scrollTo({top:0,behavior:'instant'});
}
window.goScreen=showScreen;

function renderBalances(){
 const map={
  dashBalance:money(state.availableBalance),earnPageAmount:Number(state.availableBalance).toLocaleString('en-NG'),
  chatEarnBreakdown:money(state.chatEarnings),totalEarnBreakdown:money(state.lifetimeEarnings),
  wdAmount:money(state.withdrawal?.amount||state.availableBalance),ppAmount:money(state.withdrawal?.amount||state.amountUnderReview)
 };
 Object.entries(map).forEach(([id,text])=>{if($(id))$(id).textContent=text});
 const sub=$('wdTeaserSub'),btn=$('wdTeaserBtn');
 if(sub)sub.textContent=state.availableBalance>=FIRST_WITHDRAWAL_THRESHOLD?`${money(state.availableBalance)} available for withdrawal`:`Withdrawal Progress ${money(state.availableBalance)} / ${money(FIRST_WITHDRAWAL_THRESHOLD)}`;
 if(btn){btn.textContent=state.availableBalance>=FIRST_WITHDRAWAL_THRESHOLD?'Withdraw →':'Locked 🔒';btn.disabled=state.availableBalance<FIRST_WITHDRAWAL_THRESHOLD}
}

function syncPartnerCards(){
 document.querySelectorAll('#foreignerList .foreigner-card').forEach((card,index)=>{
  const partner=PARTNERS[index];if(!partner)return;
  const rate=card.querySelector('.fc-earn');if(rate)rate.textContent=`₦${partner.rate/1000}K/reply`;
 });
 const badge=document.querySelector('#dashboard .st-badge');if(badge)badge.textContent='Automated partners available';
}
function renderDashboard(){
 if($('dashName'))$('dashName').textContent=`Welcome, ${String(state.name||'User').split(' ')[0]}!`;
 renderBalances();syncPartnerCards();
 let card=$('statusCard');
 if(state.withdrawal){
  if(!card){card=document.createElement('div');card.id='statusCard';document.querySelector('#dashboard .bonus-banner')?.after(card)}
  card.style.cssText='margin:0 16px 14px;padding:14px;border-radius:14px;background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.22)';
  card.innerHTML=`<b style="color:#69F0AE">Welcome back 🎉</b><p style="font-size:12px;color:#aebbb3">Your withdrawal request is awaiting review. Continue chatting and earning while you wait.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button onclick="continueLastChat()" style="padding:11px;border:0;border-radius:10px;background:#00C853;font-weight:900">CONTINUE LAST CHAT</button><button onclick="goScreen('processing')" style="padding:11px;border:1px solid #39413b;border-radius:10px;background:#1d221e;color:#fff;font-weight:800">VIEW STATUS</button></div>`;
 }
 mountPartnerAd();
}
function renderEarnings(){
 renderBalances();
 const host=document.querySelector('#earnings .earn-breakdown');if(!host)return;
 let extra=$('extraEarnings');
 if(!extra){extra=document.createElement('div');extra.id='extraEarnings';host.appendChild(extra)}
 extra.innerHTML=`
 <div class="eb-row"><span class="eb-key">Sponsored Earnings</span><span class="eb-val">${money(state.sponsoredEarnings)}</span></div>
 <div class="eb-row"><span class="eb-key">Amount Under Processing</span><span class="eb-val">${money(state.amountUnderReview)}</span></div>
 <div class="eb-row"><span class="eb-key">New Earnings</span><span class="eb-val">${money(state.newEarnings)}</span></div>
 <div class="eb-row"><span class="eb-key">Available for Withdrawal</span><span class="eb-val">${money(state.availableBalance)}</span></div>
 <div class="eb-row"><span class="eb-key">Lifetime Earnings</span><span class="eb-val">${money(state.lifetimeEarnings)}</span></div>`;
 mountEarningsAd();
}
function renderWithdraw(){renderBalances()}

window.openLogin=()=>$('loginModal')?.classList.add('show');
window.closeLogin=()=>$('loginModal')?.classList.remove('show');

window.doRegister=async()=>{
 const name=$('regName')?.value.trim(),email=$('regEmail')?.value.trim(),password=$('regPass')?.value||'',button=$('regSubmitBtn');
 if(!name||!email||password.length<6)return toast('Complete all fields correctly.',true);
 if(button){button.disabled=true;button.textContent='Creating account…'}
 try{
  let result=await sb.auth.signUp({email,password,options:{data:{full_name:name}}});if(result.error)throw result.error;
  let session=result.data.session;
  if(!session){result=await sb.auth.signInWithPassword({email,password});if(result.error)throw result.error;session=result.data.session}
  authUser=session?.user||result.data.user;if(!authUser)throw Error('Session could not start');
  loadState();state.name=name;creditSignupOnce();runSetup(true);
 }catch(error){toast(error.message||'Registration failed.',true)}
 finally{if(button){button.disabled=false;button.textContent='Create Account & Get ₦10,000 →'}}
};
window.doLogin=async()=>{
 const email=$('loginEmail')?.value.trim(),password=$('loginPass')?.value||'',button=$('loginBtn');
 if(!email||!password)return toast('Enter your email and password.',true);
 if(button){button.disabled=true;button.textContent='Logging in…'}
 try{
  const result=await sb.auth.signInWithPassword({email,password});if(result.error)throw result.error;
  authUser=result.data.user;loadState();state.name=state.name||authUser.user_metadata?.full_name||email.split('@')[0];closeLogin();restoreJourney();
 }catch(error){toast(error.message||'Login failed.',true)}
 finally{if(button){button.disabled=false;button.textContent='Log In & Continue →'}}
};

window.userLogout=()=>showLogoutConfirm();
function showLogoutConfirm(){
 let modal=$('logoutConfirm');
 if(!modal){modal=document.createElement('div');modal.id='logoutConfirm';modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:20px';modal.innerHTML=`<div style="width:min(100%,380px);background:#171b18;border:1px solid #303832;border-radius:18px;padding:20px"><h3>Log out of ChatEarn?</h3><p style="color:#aebbb3;font-size:13px;line-height:1.5">Your account and progress will remain saved. You can log in again with your email and password.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button onclick="document.getElementById('logoutConfirm').remove()" style="padding:12px;border:1px solid #39413b;border-radius:10px;background:#1d221e;color:#fff;font-weight:900">CANCEL</button><button onclick="confirmLogout()" style="padding:12px;border:0;border-radius:10px;background:#00C853;font-weight:900">LOG OUT</button></div></div>`;document.body.appendChild(modal)}
}
window.confirmLogout=async()=>{await sb.auth.signOut();authUser=null;state=freshState();$('logoutConfirm')?.remove();showScreen('landing')};

function runSetup(isNew){
 showScreen('loading');
 if($('ldTitle'))$('ldTitle').textContent=isNew?'Setting Up Your Account':'Welcome Back';
 if($('ldSub'))$('ldSub').textContent='Matching you with an available guided chat…';
 let progress=0;clearInterval(runSetup.timer);
 runSetup.timer=setInterval(()=>{progress+=20;if($('ldFill'))$('ldFill').style.width=`${progress}%`;if(progress>=100){clearInterval(runSetup.timer);openChat(Math.floor(Math.random()*PARTNERS.length),true)}},250);
}
function conversation(name){state.conversations[name]??=[];return state.conversations[name]}
function lastPartnerMessage(){return conversation(currentPartner.name).filter(m=>m.type==='partner').at(-1)?.text||currentPartner.opening}
function partnerResponse(text){
 const normalized=String(text||'').toLowerCase();
 const matched=currentPartner.branches.find(branch=>branch.match.length&&branch.match.some(key=>normalized.includes(key)));
 return matched||contextualResponse(text);
}
function messageBubble(message){
 const body=$('chatBody');
 if(message.type==='ad'){
  const ad=AD_CONFIG.inlineChat.find(item=>item.id===message.adId);if(ad)body.appendChild(adCard(ad,'inlineChat'));return;
 }
 const row=document.createElement('div');row.className=`msg-row ${message.type==='user'?'mine':''}`;
 row.innerHTML=`<div class="msg-bubble ${message.type==='user'?'msg-mine':'msg-theirs'}"><div>${esc(message.text)}</div><div style="font-size:9px;opacity:.65;text-align:right;margin-top:5px">${message.time||stamp()}${message.type==='user'?' ✓✓':''}</div></div>${message.reward?`<div style="font-size:10px;color:#69F0AE;margin-top:4px">Reply accepted<br>+${money(message.reward)} added to your earnings</div>`:''}`;
 body.appendChild(row);
}
function typingIndicator(){const body=$('chatBody'),row=document.createElement('div');row.className='msg-row';row.id='typingRow';row.innerHTML='<div class="msg-bubble msg-theirs"><span class="typing-dots">•••</span></div>';body.appendChild(row);body.scrollTop=body.scrollHeight;return row}
function suggestions(items){
 const host=$('quickReplies');if(!host)return;host.innerHTML='';
 (items||['That’s interesting 😊','Tell me more','How about you?']).forEach(text=>{const button=document.createElement('button');button.type='button';button.className='quick-reply';button.textContent=text;button.onclick=()=>{if($('chatInput'))$('chatInput').value=text;sendMsg()};host.appendChild(button)});
}
function drawConversation(){
 const body=$('chatBody');if(!body||!currentPartner)return;
 body.innerHTML='<div class="chat-day">TODAY</div>';
 conversation(currentPartner.name).forEach(messageBubble);
 const latestUser=conversation(currentPartner.name).filter(m=>m.type==='user').at(-1)?.text||'';
 suggestions(partnerResponse(latestUser).suggestions);
 withdrawalUnlockCard();
 body.scrollTop=body.scrollHeight;
}
function openingMessage(){
 if(conversation(currentPartner.name).length)return drawConversation();
 drawConversation();const row=typingIndicator();
 setTimeout(()=>{row.remove();conversation(currentPartner.name).push({id:`OPEN-${currentPartner.name}`,type:'partner',text:currentPartner.opening,time:stamp()});saveState();drawConversation()},900);
}
function openChat(index,first=false){
 currentPartner=PARTNERS[Number(index)]||PARTNERS[0];state.lastPartner=currentPartner.name;
 if($('chatName'))$('chatName').textContent=currentPartner.name;
 if($('chatAv'))$('chatAv').textContent=currentPartner.initials;
 if($('chatStatus'))$('chatStatus').textContent=`🟢 Automated chat partner · Available now · ${currentPartner.flag} ${currentPartner.country}`;
 if($('chatEarnBadge'))$('chatEarnBadge').textContent=`+${money(currentPartner.rate)}/reply`;
 showScreen('chat');first?openingMessage():drawConversation();setTimeout(()=>$('chatInput')?.focus(),100);
}
window.openChat=openChat;
window.handleEnter=event=>{if(event.key==='Enter'){event.preventDefault();sendMsg()}};

function qualifiesForReward(text){
 const trimmed=text.trim(),now=Date.now();
 if(trimmed.length<2)return{ok:false,reason:'Write a meaningful reply.'};
 if(state.lastRewardText&&trimmed.toLowerCase()===state.lastRewardText.toLowerCase())return{ok:false,reason:'Repeated replies are not rewarded.'};
 if(now-Number(state.lastRewardAt||0)<1200)return{ok:false,reason:'Please wait before sending another rewarded reply.'};
 return{ok:true};
}
function sendMsg(){
 if(busy||!currentPartner)return;
 const input=$('chatInput'),text=input?.value.trim();if(!text)return;
 const qualification=qualifiesForReward(text);
 busy=true;input.disabled=true;input.value='';
 const id=transactionId(),messages=conversation(currentPartner.name);
 const reward=qualification.ok?currentPartner.rate:0;
 messages.push({id,type:'user',text,time:stamp(),reward,transactionRef:reward?id:null});
 if(reward&&!state.rewardedMessageIds[id]){
  state.rewardedMessageIds[id]=true;state.chatEarnings+=reward;state.lastRewardText=text;state.lastRewardAt=Date.now();
  state.ad.replyCounter+=1;
 }
 saveState();drawConversation();
 if(!qualification.ok)toast(qualification.reason,true);
 if(state.availableBalance>=FIRST_WITHDRAWAL_THRESHOLD&&!state.unlockShown){state.unlockShown=true;saveState();toast('Withdrawal unlocked 🎉 You can withdraw now or keep chatting.')}
 maybeShowAd();
 const turn=(state.partnerTurns[currentPartner.name]||0)+1;state.partnerTurns[currentPartner.name]=turn;
 const response=partnerResponse(text),typing=typingIndicator();
 setTimeout(()=>{typing.remove();messages.push({id:`P-${currentPartner.name}-${Date.now()}`,type:'partner',text:response.reply,time:stamp()});saveState();drawConversation();busy=false;input.disabled=false;input.focus()},900);
}
window.sendMsg=sendMsg;

function withdrawalUnlockCard(){
 const body=$('chatBody');body?.querySelector('[data-unlock]')?.remove();
 if(!body||state.availableBalance<FIRST_WITHDRAWAL_THRESHOLD||state.withdrawal)return;
 const card=document.createElement('div');card.dataset.unlock='1';card.style.cssText='margin:14px 0;padding:15px;border-radius:15px;background:rgba(0,200,83,.12);border:1px solid rgba(0,200,83,.35)';
 card.innerHTML='<b style="color:#69F0AE">Withdrawal Unlocked 🎉</b><p style="font-size:12px">You can withdraw now or continue chatting to earn more.</p><div style="display:flex;gap:8px"><button onclick="goScreen(\'earnings\')" style="flex:1;padding:10px;border:0;border-radius:10px;background:#00C853;font-weight:900">VIEW MY EARNINGS</button><button onclick="document.getElementById(\'chatInput\')?.focus()" style="flex:1;padding:10px;border:1px solid #39413b;border-radius:10px;background:#1d221e;color:#fff;font-weight:900">KEEP CHATTING</button></div>';
 body.appendChild(card);
}
window.tryWithdraw=()=>state.availableBalance<FIRST_WITHDRAWAL_THRESHOLD?toast(`${money(FIRST_WITHDRAWAL_THRESHOLD-state.availableBalance)} remaining before withdrawal.`,true):showScreen('earnings');
window.selectBank=value=>{selectedBank=value;$('bankOpay')?.classList.toggle('selected',value==='opay');$('bankPalmpay')?.classList.toggle('selected',value==='palmpay')};
window.triggerBankVerify=value=>{const status=$('bankVerifyStatus');if(status){status.style.display=String(value).length===10?'block':'none';status.textContent=String(value).length===10?'Account details entered. Confirm the account name before submitting.':''}};

window.placeWithdrawal=()=>{
 if(state.withdrawal)return toast('A withdrawal request already exists. View its status instead.',true);
 const accountNumber=String($('wdAccNo')?.value||''),accountName=$('wdAccName')?.value.trim();
 if(accountNumber.length!==10||!accountName)return toast('Enter a valid account number and account name.',true);
 const amount=state.availableBalance;
 state.withdrawal={id:`WD-${Date.now()}`,amount,bank:selectedBank==='opay'?'OPay':'PalmPay',accountNumber,accountName,submittedAt:nowISO(),status:'requirements_in_progress'};
 state.amountUnderReview=amount;state.paymentStatus='requirements_in_progress';saveState();
 toast('Withdrawal request created. Continue with the sharing stage.');
 showScreen('sharewall');
};

function referralLink(){return`${location.origin}${location.pathname}?ref=${encodeURIComponent(state.referralCode)}`}
function buildWhatsAppMessage(){
 return `💰 I just earned ${money(state.lifetimeEarnings)} on ChatEarn chatting!\nChatEarn gives users access to chat-based earning activities.\n✅ Free to join\n✅ Earn from approved replies\n✅ Withdraw through supported Nigerian banks\nSign up here 👇\n${referralLink()}\nMy withdrawal journey is currently in progress 🔥`;
}
function shareCooldownRemaining(){return Math.max(0,Number(state.sharing.cooldownUntil||0)-Date.now())}
function renderShare(){
 if($('swHeroTitle'))$('swHeroTitle').textContent='Complete Your Sharing Stage';
 if($('swHeroSub'))$('swHeroSub').textContent='Share your ChatEarn invitation through WhatsApp and return to continue.';
 const waiting=document.querySelector('#sharewall .sw-body > div[style*="255,215,0"]');if(waiting)waiting.innerHTML=`⚡ <strong>Your ${money(state.withdrawal?.amount||state.amountUnderReview)} request is recorded.</strong> Complete the sharing stage to continue.`;
 const note=document.querySelector('#sharewall .sw-note');if(note)note.textContent='Each action records that the WhatsApp share interface was opened and you returned.';
 const percent=Math.round((state.sharing.count/REQUIRED_SHARE_ACTIONS)*100);
 if($('swPct'))$('swPct').textContent=`${percent}%`;
 if($('swFill'))$('swFill').style.width=`${percent}%`;
 if($('swStatus'))$('swStatus').textContent=state.sharing.count>=REQUIRED_SHARE_ACTIONS?'Sharing Stage Complete 🎉':`Progress: ${percent}%`;
 if($('swBtnText'))$('swBtnText').textContent=state.sharing.pending?'Share activity opened — return here':'SHARE ON WHATSAPP';
 const main=$('btnShareWA');if(main){main.disabled=state.sharing.pending||shareCooldownRemaining()>0||state.sharing.count>=REQUIRED_SHARE_ACTIONS}
 let tools=$('shareTools');
 if(!tools){tools=document.createElement('div');tools.id='shareTools';document.querySelector('#sharewall .sw-body')?.appendChild(tools)}
 tools.innerHTML=`<div style="display:grid;gap:9px;margin-top:12px"><button onclick="copyInvitationLink()" style="padding:12px;border:1px solid #39413b;border-radius:10px;background:#1e231f;color:#fff;font-weight:900">COPY INVITATION LINK</button>${state.sharing.count>=REQUIRED_SHARE_ACTIONS?'<div style="padding:14px;border:1px solid rgba(0,200,83,.3);background:rgba(0,200,83,.08);border-radius:12px"><b style="color:#69F0AE">Sharing Stage Complete 🎉</b><p style="font-size:12px">Continue to identity verification to complete your reward requirements.</p><button onclick="goScreen(\'kyc\')" style="width:100%;padding:12px;border:0;border-radius:10px;background:#00C853;font-weight:900">COMPLETE YOUR KYC</button></div>':''}<button onclick="goScreen('processing')" style="padding:10px;border:0;background:transparent;color:#9ba79f;text-decoration:underline">VIEW WITHDRAWAL STATUS</button></div>`;
}
window.doShareWA=()=>{
 if(!state.withdrawal)return toast('Submit your bank details first.',true);
 if(state.sharing.pending||shareCooldownRemaining()>0)return toast('Please wait before starting another share activity.',true);
 if(state.sharing.count>=REQUIRED_SHARE_ACTIONS)return renderShare();
 state.sharing.pending=true;state.sharing.openedAt=nowISO();state.sharing.events.push({type:'whatsapp_share_opened',at:state.sharing.openedAt});saveState();renderShare();
 toast('Share activity opened. Please complete your invitation in WhatsApp, then return here.');
 window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(buildWhatsAppMessage())}`,'_blank','noopener,noreferrer');
};
window.copyInvitationLink=async()=>{try{await navigator.clipboard.writeText(referralLink());state.sharing.events.push({type:'invitation_link_copied',at:nowISO()});saveState();toast('Invitation link copied.')}catch{toast('Copy failed.',true)}};
window.copyReferral=window.copyInvitationLink;
window.shareAgain=window.doShareWA;

function handleReturn(){
 if(state.sharing.pending&&document.visibilityState==='visible'){
  state.sharing.pending=false;state.sharing.returnedAt=nowISO();state.sharing.cooldownUntil=Date.now()+SHARE_COOLDOWN_MS;
  state.sharing.count=Math.min(REQUIRED_SHARE_ACTIONS,state.sharing.count+1);
  state.sharing.events.push({type:'user_returned',at:state.sharing.returnedAt},{type:'share_action_recorded',at:nowISO()});
  saveState();toast('Welcome back. Checking your sharing activity…');renderShare();
  clearTimeout(shareReturnTimer);shareReturnTimer=setTimeout(()=>{state.sharing.cooldownUntil=0;saveState();renderShare()},SHARE_COOLDOWN_MS);
 }
 if(state.kyc.openedAt&&!state.kyc.returnedAt&&document.visibilityState==='visible'){
  state.kyc.returnedAt=nowISO();state.kyc.status='returned_from_kyc';state.paymentStatus='pending_review';saveState();showScreen('processing');
 }
}
document.addEventListener('visibilitychange',handleReturn);
window.addEventListener('pageshow',handleReturn);

function renderKYC(){
 const hero=document.querySelector('#kyc .kyc-hero p');if(hero)hero.textContent='Continue to identity verification to complete your reward requirements.';
 const statuses=document.querySelectorAll('#kyc .ks-status');
 if(statuses[2])statuses[2].textContent=`${state.sharing.count}/${REQUIRED_SHARE_ACTIONS}`;
 if(statuses[3])statuses[3].textContent=state.kyc.status.replaceAll('_',' ');
 const button=document.querySelector('.btn-complete-kyc');
 if(button){button.textContent='COMPLETE YOUR KYC';button.disabled=false}
}
window.doKYC=()=>{
 if(!state.withdrawal)return toast('Create a withdrawal request first.',true);
 if(!validUrl(KYC_CONFIG.url))return toast('KYC destination has not been configured yet.',true);
 state.kyc.status='kyc_link_opened';state.kyc.openedAt=nowISO();state.kyc.returnedAt=null;state.kyc.withdrawalId=state.withdrawal.id;currentScreen='kyc_external';saveState();
 window.open(KYC_CONFIG.url,'_blank','noopener,noreferrer');
};

function maskedAccount(){const number=String(state.withdrawal?.accountNumber||'');return number?`${'*'.repeat(Math.max(0,number.length-4))}${number.slice(-4)}`:'—'}
function renderProcessing(){
 const w=state.withdrawal;
 if($('ppAmount'))$('ppAmount').textContent=money(w?.amount||state.amountUnderReview);
 if($('ppBank'))$('ppBank').textContent=w?.bank||'Selected bank';
 if($('ppRef'))$('ppRef').textContent=w?.id||'—';
 const title=document.querySelector('#processing .pp-title');if(title)title.textContent=state.kyc.openedAt?'Withdrawal Request Under Review':'Withdrawal Request Submitted';
 const sub=document.querySelector('#processing .pp-sub');
 if(sub)sub.innerHTML=`Amount: <b>${money(w?.amount||0)}</b><br>Bank: <b>${esc(w?.bank||'—')}</b><br>Account: <b>${maskedAccount()}</b><br>Sharing: <b>${state.sharing.count>=REQUIRED_SHARE_ACTIONS?'Completed':`${state.sharing.count} of ${REQUIRED_SHARE_ACTIONS}`}</b><br>KYC: <b>${state.kyc.openedAt?'Opened / Under Review':'Not Started'}</b><br>Payment: <b>Pending Approval</b>`;
 if($('ppBankNote'))$('ppBankNote').textContent='Only the future backend or Admin Panel can approve, process or complete this request.';
 const timeline=document.querySelectorAll('#processing .pt-title');
 if(timeline[0])timeline[0].textContent='Withdrawal Submitted ✓';
 if(timeline[1])timeline[1].textContent=state.kyc.openedAt?'KYC Link Opened':'KYC Not Started';
 if(timeline[2])timeline[2].textContent='Payment Pending Approval';
 let actions=$('processingActions');
 if(!actions){actions=document.createElement('div');actions.id='processingActions';document.querySelector('#processing')?.appendChild(actions)}
 actions.style.cssText='width:100%;padding:0 20px;margin-top:12px;display:grid;gap:8px';
 actions.innerHTML='<button onclick="returnToChat()" style="width:100%;padding:15px;border:0;border-radius:12px;background:#00C853;font-weight:900">RETURN TO CHAT & CONTINUE EARNING</button><button onclick="goScreen(\'processing\')" style="width:100%;padding:12px;border:1px solid #39413b;border-radius:12px;background:#1d221e;color:#fff;font-weight:800">VIEW WITHDRAWAL STATUS</button>';
}
window.returnToChat=()=>{continueLastChat();toast('Your withdrawal request is awaiting review. Continue chatting and earning while you wait.')};
window.continueLastChat=()=>{const index=PARTNERS.findIndex(p=>p.name===state.lastPartner);index>=0?openChat(index):showScreen('dashboard')};

function eligibleAds(group){return(group||[]).filter(ad=>ad.active)}
function adEvent(type,ad,placement){state.ad.events.push({type,adId:ad.id,url:ad.url,placement,partner:currentPartner?.name||null,messageCount:state.ad.replyCounter,timestamp:nowISO()});saveState()}
function adCard(ad,placement){
 const card=document.createElement('div');card.dataset.adId=ad.id;card.style.cssText='margin:14px 0;padding:14px;border:1px solid rgba(255,215,0,.25);background:rgba(255,215,0,.06);border-radius:14px';
 card.innerHTML=`<div style="font-size:10px;color:#FFD54F;font-weight:900">Sponsored</div><b>${esc(ad.title)}</b>${ad.description?`<p style="font-size:12px;color:#b7c0ba">${esc(ad.description)}</p>`:''}<button style="width:100%;padding:11px;border:0;border-radius:10px;background:#FFD54F;font-weight:900">${esc(ad.buttonText)}</button>`;
 const button=card.querySelector('button');button.onclick=()=>{adEvent('ad_open',ad,placement);if(validUrl(ad.url))window.open(ad.url,'_blank','noopener,noreferrer');else toast('Sponsored opportunity is being configured. Please check again shortly.',true)};
 requestAnimationFrame(()=>adEvent('ad_impression',ad,placement));return card;
}
function maybeShowAd(){
 if(state.ad.replyCounter<state.ad.nextInterval)return;
 const ads=eligibleAds(AD_CONFIG.inlineChat).filter(a=>a.id!==state.ad.lastAdId);if(!ads.length){state.ad.replyCounter=0;state.ad.nextInterval=randomInterval();saveState();return}
 const ad=ads[0],shown=Number(state.ad.shown[ad.id]||0);if(shown>=Number(ad.maximumShowsPerSession||1))return;
 const messages=conversation(currentPartner.name);messages.push({id:`AD-${ad.id}-${Date.now()}`,type:'ad',adId:ad.id,time:stamp()});
 state.ad.shown[ad.id]=shown+1;state.ad.lastAdId=ad.id;state.ad.replyCounter=0;state.ad.nextInterval=randomInterval();saveState();drawConversation();
 maybeHalfScreen();
}
function maybeHalfScreen(){
 const ads=eligibleAds(AD_CONFIG.halfScreen);if(!ads.length||sessionStorage.getItem('ce-half-screen-shown'))return;
 const ad=ads[0];sessionStorage.setItem('ce-half-screen-shown','1');
 const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:20px';
 const card=adCard(ad,'halfScreen');card.style.cssText+=';width:min(100%,420px);max-height:50vh;overflow:auto;position:relative';
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close sponsored panel');close.style.cssText='position:absolute;right:10px;top:8px;border:0;background:transparent;color:#fff;font-size:25px';close.onclick=()=>overlay.remove();card.prepend(close);overlay.appendChild(card);document.body.appendChild(overlay);
}
function mountPartnerAd(){
 const ad=eligibleAds(AD_CONFIG.partnerList)[0],host=document.querySelector('#dashboard .foreigner-list');if(!ad||!host||$('partnerListAd'))return;
 const wrapper=adCard(ad,'partnerList');wrapper.id='partnerListAd';host.prepend(wrapper);
}
function mountEarningsAd(){
 const ad=eligibleAds(AD_CONFIG.earnings)[0],host=document.querySelector('#earnings');if(!ad||!host||$('earningsAd'))return;
 const wrapper=adCard(ad,'earnings');wrapper.id='earningsAd';host.appendChild(wrapper);
}

window.claimStreak=()=>{$('streakModal')&&($('streakModal').style.display='none')};
window.closeBackWarn=()=>$('backWarn')?.classList.remove('show');
window.trackClick=()=>true;

function injectCSS(){
 const style=document.createElement('style');style.textContent=`#chat{height:100dvh;overflow:hidden}.chat-header{position:sticky;top:0;z-index:100;padding-top:env(safe-area-inset-top)}.chat-body{height:calc(100dvh - 145px - env(safe-area-inset-bottom));overflow-y:auto;padding:14px 12px 150px!important;scroll-behavior:smooth}.chat-input-wrap{position:fixed;left:0;right:0;bottom:0;max-width:480px;margin:auto;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:#111511}.msg-row{display:flex;flex-direction:column;align-items:flex-start;margin:8px 0}.msg-row.mine{align-items:flex-end}.msg-bubble{max-width:82%;padding:10px 12px;border-radius:18px;line-height:1.45}.msg-theirs{background:#242824;border-bottom-left-radius:5px}.msg-mine{background:#075e54;border-bottom-right-radius:5px}.chat-day{text-align:center;font-size:10px;color:#7c8880;margin:10px 0}.quick-replies{bottom:78px}.quick-reply:disabled{opacity:.45}`;
 document.head.appendChild(style);document.documentElement.dataset.build='ChatEarn Alignment Hotfix 2026.07.21';
}
function restoreJourney(){
 let nav={};try{nav=JSON.parse(localStorage.getItem(navKey())||'{}')}catch{}
 if(state.kyc.openedAt&&!state.kyc.returnedAt){handleReturn();return}
 if(nav.screen==='chat'&&nav.partner){const index=PARTNERS.findIndex(p=>p.name===nav.partner);openChat(index>=0?index:0)}
 else if(state.withdrawal&&['sharewall','kyc','processing'].includes(nav.screen))showScreen(nav.screen)
 else if(state.lastPartner){showScreen('dashboard')}
 else runSetup(false);
}
async function boot(){
 injectCSS();const result=await sb.auth.getSession();authUser=result.data.session?.user||null;
 if(!authUser)return showScreen('landing');
 loadState();state.name=state.name||authUser.user_metadata?.full_name||authUser.email?.split('@')[0]||'User';creditSignupOnce();restoreJourney();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
