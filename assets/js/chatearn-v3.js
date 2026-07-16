/* ChatEarn V3 coordinated upgrade. Existing public copy is preserved. */
(() => {
  'use strict';

  const CE_V3_VERSION='3.1';
  const CE_V3_ADMIN_POLL=60000;
  const CE_REF_CODE=(new URLSearchParams(location.search).get('ref')||'').trim();
  const ceAdminClient=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'chatearn-admin-v3-auth'}
  });
  let ceVisitInfo={visit_number:1,is_returning:false,last_visit_at:null};
  let ceCurrentOffer=null;
  let ceOfferOpenState=null;
  let ceSessionMessageCount=0;
  let ceLastShareOpenAt=0;
  let ceLastShareStep=0;
  let ceAdminChannelsV3=[];
  let ceVisitPromise=null,ceVisitLoadedAt=0;
  const ceOfferImpressions=new Set();
  const ceConversationMemory={};

  const ceSafe=(fn)=>{try{return fn()}catch(e){console.warn('ChatEarn V3:',e);return null}};
  const ceDateKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const ceFmtDate=(value)=>value?new Date(value).toLocaleString('en-NG',{timeZone:'Africa/Lagos',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Earlier';
  const ceIdentity=()=>currentUser?.id||VISITOR_ID;
  const ceProfileRef=()=>currentProfile?.referral_code||currentUser?.id||'';

  async function ceRegisterVisit(force=false){
    if(!force&&ceVisitPromise)return ceVisitPromise;
    if(!force&&Date.now()-ceVisitLoadedAt<10000)return ceVisitInfo;
    ceVisitPromise=(async()=>{try{
      const d=deviceInfo();
      const {data,error}=await supabaseClient.rpc('chatearn_v3_register_visit',{
        p_session_id:SESSION_ID,p_visitor_id:VISITOR_ID,
        p_source:document.referrer||CE_REF_CODE||'direct',p_ref_code:CE_REF_CODE||null,
        p_device:d.device,p_browser:d.browser
      });
      if(error)throw error;
      if(data&&typeof data==='object')ceVisitInfo=data;
      if(currentUser&&CE_REF_CODE){
        await supabaseClient.rpc('chatearn_v3_attach_referral',{
          p_ref_code:CE_REF_CODE,p_visitor_id:VISITOR_ID,p_session_id:SESSION_ID,p_event_type:'registration'
        });
      }
      await ceLoadOffer('all');
      ceRenderReturnCard();
      cePrepareOfferCards();ceVisitLoadedAt=Date.now();return ceVisitInfo;
    }catch(e){console.warn('Visit registration:',e?.message||e);return ceVisitInfo}
    finally{ceVisitPromise=null}})();
    return ceVisitPromise;
  }

  async function ceLoadOffer(placement='all'){
    try{
      const {data,error}=await supabaseClient.rpc('chatearn_v3_get_offer',{
        p_placement:placement,p_visitor_id:VISITOR_ID,p_session_id:SESSION_ID,p_messages:ceSessionMessageCount
      });
      if(error)throw error;
      ceCurrentOffer=data?.available?data:null;
      return ceCurrentOffer;
    }catch(e){console.warn('Offer load:',e?.message||e);return null}
  }

  async function ceTrackOffer(type,placement,secondsAway=null,metadata={}){
    if(!ceCurrentOffer?.offer_key)return;
    try{
      await supabaseClient.rpc('chatearn_v3_track_offer_event',{
        p_offer_key:ceCurrentOffer.offer_key,p_event_type:type,p_visitor_id:VISITOR_ID,
        p_session_id:SESSION_ID,p_placement:placement,p_visit_number:Number(ceVisitInfo.visit_number||1),
        p_messages_before:ceSessionMessageCount,p_seconds_away:secondsAway,p_metadata:metadata||{}
      });
    }catch(e){console.warn('Offer event:',e?.message||e)}
  }

  function ceRecordImpression(placement){
    if(!ceCurrentOffer?.offer_key)return;
    const key=`${SESSION_ID}:${placement}:${ceCurrentOffer.offer_key}`;
    if(ceOfferImpressions.has(key))return;
    ceOfferImpressions.add(key);ceTrackOffer('impression',placement);
  }

  function ceOpenOffer(placement='unknown',event){
    event?.preventDefault?.();event?.stopPropagation?.();
    if(!ceCurrentOffer?.url){showToast('⚠️ Offer is currently unavailable');return false}
    ceOfferOpenState={offer_key:ceCurrentOffer.offer_key,placement,opened_at:Date.now(),messages:ceSessionMessageCount};
    sessionStorage.setItem('ce_v3_offer_open',JSON.stringify(ceOfferOpenState));
    ceTrackOffer('open',placement,null,{name:ceCurrentOffer.name});
    const opened=window.open(ceCurrentOffer.url,'_blank','noopener');
    if(!opened){ceTrackOffer('error',placement,null,{reason:'popup_blocked'});showToast('⚠️ Allow pop-ups, then try again')}
    return false;
  }
  window.ceOpenOffer=ceOpenOffer;

  async function ceHandleOfferReturn(){
    let state=ceOfferOpenState;
    if(!state){try{state=JSON.parse(sessionStorage.getItem('ce_v3_offer_open')||'null')}catch(e){}}
    if(!state?.opened_at)return false;
    const away=Math.max(0,Math.round((Date.now()-state.opened_at)/1000));
    if(away<2)return false;
    ceOfferOpenState=null;sessionStorage.removeItem('ce_v3_offer_open');
    await ceTrackOffer('return',state.placement,away,{messages_at_open:state.messages});
    trackEvent('offer_returned',{offer_key:state.offer_key,placement:state.placement,seconds_away:away});
    return true;
  }

  function ceExistingAdCards(){
    return [...document.querySelectorAll('a[onclick*="dash_ad"],a[onclick*="earn_ad"],a[href="https://jikgykm.com/cl/a9f1535a330a2652"]')];
  }

  function cePrepareOfferCards(){
    const all=ceExistingAdCards();if(!all.length)return;
    const dash=all.filter(a=>(a.getAttribute('onclick')||'').includes('dash_ad'));
    const earn=all.filter(a=>!dash.includes(a));
    const choose=(cards,placement)=>{
      if(!cards.length)return;
      const index=(Number(ceVisitInfo.visit_number||1)-1)%cards.length;
      cards.forEach((a,i)=>{
        a.classList.toggle('ce-offer-active',i===index&&!!ceCurrentOffer);
        a.classList.toggle('ce-offer-hidden',i!==index||!ceCurrentOffer);
        if(i===index&&ceCurrentOffer){
          a.href=ceCurrentOffer.url;a.target='_blank';a.removeAttribute('onclick');
          a.onclick=(ev)=>ceOpenOffer(placement,ev);
          ceRecordImpression(placement);
        }
      });
    };
    choose(dash,'dashboard');choose(earn,'earnings');
    const dashContainer=dash[0]?.parentElement,withdraw=document.querySelector('.withdraw-teaser');
    if(dashContainer&&withdraw&&withdraw.parentElement===dashContainer.parentElement){withdraw.before(dashContainer)}
  }

  function ceCreateStickyStart(){
    if(document.getElementById('ceStickyStart'))return;
    const b=document.createElement('button');b.id='ceStickyStart';b.className='ce-sticky-start';b.textContent='🚀 Start Earning Now — Free';
    b.onclick=()=>{trackEvent('sticky_start_clicked');goScreen('register')};document.body.appendChild(b);
    const main=document.querySelector('.btn-start');
    if(main&&'IntersectionObserver'in window){new IntersectionObserver(entries=>{const visible=entries[0]?.isIntersecting;b.classList.toggle('show',currentScreen==='landing'&&!visible)},{threshold:.2}).observe(main)}
    window.addEventListener('scroll',()=>b.classList.toggle('show',currentScreen==='landing'&&scrollY>260),{passive:true});
  }

  function ceOptimizeLandingOrder(){
    const hero=document.querySelector('.land-hero'),btn=hero?.querySelector('.btn-start'),trust=hero?.querySelector('.land-trust'),rates=hero?.querySelector('.earn-rates');
    if(hero&&btn&&rates){rates.before(btn);btn.after(trust)}
  }

  function ceCreateJourney(){
    if(document.getElementById('ceJourney'))return;
    const el=document.createElement('div');el.id='ceJourney';el.className='ce-journey';
    el.innerHTML='<span data-step="account">Account ✓</span><i>→</i><span data-step="chat">Chatting</span><i>→</i><span data-step="earn">Earnings</span><i>→</i><span data-step="withdraw">Withdrawal</span>';
    const banner=document.querySelector('.bonus-banner');banner?.after(el);ceUpdateJourney();
  }
  function ceUpdateJourney(){
    const map={landing:'account',register:'account',loading:'account',dashboard:'chat',chat:'chat',earnings:'earn',withdraw:'withdraw',sharewall:'withdraw',kyc:'withdraw',processing:'withdraw'};
    const active=map[currentScreen]||'account';document.querySelectorAll('#ceJourney span').forEach(s=>s.classList.toggle('active',s.dataset.step===active));
  }

  function ceCreateReturnCard(){
    if(document.getElementById('ceReturnCard'))return;
    const el=document.createElement('div');el.id='ceReturnCard';el.className='ce-return-card';
    el.innerHTML=`<div class="ce-return-top"><div><div class="ce-return-title" id="ceReturnTitle">Welcome back</div><div class="ce-return-sub" id="ceReturnSub"></div></div><div class="ce-return-badge" id="ceReturnBadge"></div></div><div class="ce-return-actions"><button class="ce-return-btn" id="ceContinueChat">Continue Chat</button><button class="ce-return-btn secondary" id="ceAnotherPartner">Choose Another Partner</button></div>`;
    document.querySelector('.dash-header')?.after(el);
    el.querySelector('#ceContinueChat').onclick=()=>ceContinueConversation();
    el.querySelector('#ceAnotherPartner').onclick=()=>openChat(ceDailyPartnerIndex(true));
  }

  async function ceRenderReturnCard(){
    ceCreateReturnCard();const card=document.getElementById('ceReturnCard');if(!card)return;
    const returning=Number(ceVisitInfo.visit_number||1)>1;
    card.classList.toggle('show',returning&&!!currentUser);if(!returning||!currentUser)return;
    let thread=null;
    try{const {data}=await supabaseClient.from('chatearn_chat_threads').select('*').eq('user_id',currentUser.id).order('last_message_at',{ascending:false}).limit(1);thread=data?.[0]||null}catch(e){}
    const partner=thread?.partner_key||currentProfile?.last_partner||FOREIGNERS[ceDailyPartnerIndex()].name;
    const unread=Number(thread?.unread_count||0);
    document.getElementById('ceReturnTitle').textContent=`Welcome back, ${userName||'User'}`;
    document.getElementById('ceReturnSub').textContent=`Last visit: ${ceFmtDate(ceVisitInfo.last_visit_at||currentProfile?.last_visit_at)} · Continue your conversation with ${partner}`;
    document.getElementById('ceReturnBadge').textContent=`${unread} unread · ${Number(currentProfile?.conversation_streak||0)} day streak`;
    card.dataset.partner=partner;
  }

  function ceContinueConversation(){
    const name=document.getElementById('ceReturnCard')?.dataset.partner;
    const idx=Math.max(0,FOREIGNERS.findIndex(f=>f.name===name));openChat(idx);
  }

  function ceDailyPartnerIndex(alternate=false){
    const key=ceDateKey().replace(/\D/g,'');let hash=[...key].reduce((a,c)=>a+Number(c),0)+(alternate?2:0);return hash%FOREIGNERS.length;
  }
  function ceRotatePartners(){
    const list=document.getElementById('foreignerList');if(!list)return;
    const cards=[...list.children],start=ceDailyPartnerIndex();
    [...cards.slice(start),...cards.slice(0,start)].forEach(c=>list.appendChild(c));
  }

  function ceEnhancePartnerCards(){
    document.querySelectorAll('.foreigner-card').forEach(card=>{
      if(card.querySelector('.ce-card-action'))return;
      const action=document.createElement('div');action.className='ce-card-action';action.textContent=card.querySelector('.fc-preview')?.textContent&&!/start chatting/i.test(card.querySelector('.fc-preview').textContent)?'Continue':'Chat';
      card.querySelector('.fc-body')?.appendChild(action);
    });
  }

  const CE_INTENTS={
    greeting:['hello','hey','hi ','what\'s up','whats up'],mood:['how are you','how is your day','how\'s your day','you good'],
    location:['where are you from','which part','where in nigeria','which state','where do you live','your city'],
    work:['what do you do','work','job','school','study','course'],music:['music','artist','song','afrobeats','burna','wizkid','davido'],
    food:['food','eat','meal','jollof','suya','dish'],hobby:['free time','hobby','fun','relax','weekend','stay home','go out'],
    weather:['weather','rain','sunny','cold','hot'],travel:['travel','visit','country','place would you'],family:['family','brother','sister','siblings'],
    time:['what time','time is it'],relationship:['single','relationship','married','boyfriend','girlfriend']
  };
  function ceIntent(text=''){const p=String(text).toLowerCase();for(const [k,words] of Object.entries(CE_INTENTS))if(words.some(w=>p.includes(w)))return k;return 'general'}
  function ceSuggestions(prompt=''){
    const intent=ceIntent(prompt),sets={
      greeting:['Hey 😊 I’m doing well','Hello! Nice to meet you','I’m good. How about you?','Hi 👋 How is your day going?'],
      mood:['I’m good, thanks 😊','My day is going well','A little busy, but I’m okay','I’m fine. How about you?'],
      location:['I’m from Lagos','I’m from Ogun State','I’m in Abuja','I’m from Nigeria. What about you?'],
      work:['I’m a student','I work in tech','I run a small business','I’m still figuring things out. What about you?'],
      music:['I mostly listen to Afrobeats','I enjoy gospel music','Hip-hop and R&B mostly','I listen to different genres. What about you?'],
      food:['Nigerian jollof wins 😂','I love rice and chicken','Suya is one of my favourites','What food do you enjoy there?'],
      hobby:['I enjoy watching movies','I mostly listen to music','I spend time with friends','I like learning new things'],
      weather:['It’s warm here today','It has been raining lately','The weather is calm today','How is the weather there?'],
      travel:['I’d love to travel someday','Nigeria has many places to visit','I’d like to see your city too','Which place would you recommend?'],
      family:['I have a close family','Yes, I have siblings','My family is doing well','What about your family?'],
      time:[`It’s ${new Date().toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'})} here`,'We’re in different time zones 😄','What time is it there?','Are you usually awake this late?'],
      relationship:['I’m focused on myself right now','I prefer to know someone well first','That is a personal question 😄','What made you ask?'],
      general:['That’s interesting 😊','Tell me more about that','How about you?','What happened next?']
    };return sets[intent]||sets.general;
  }

  function cePartnerFacts(){return PARTNER_FACTS[currentChatUser?.name]||{city:currentChatUser?.country||'my city',job:'a regular job',music:'a mix of music'}}
  function ceReplyToUserQuestion(text){
    const q=String(text||'').toLowerCase(),f=cePartnerFacts();
    if(q.includes('where are you')||q.includes('where do you live')||q.includes('which city'))return `I’m in ${f.city}.`;
    if(q.includes('what do you do')||q.includes('your job')||q.includes('your work'))return `I work in ${f.job}.`;
    if(q.includes('music')||q.includes('artist'))return `I listen to ${f.music}.`;
    if(q.includes('how are you')||q.includes('how about you'))return 'I’m doing well, thanks for asking 😊';
    if(q.includes('food'))return 'I enjoy trying different food, especially something spicy.';
    return '';
  }
  function ceAcknowledge(userText,intent){
    const u=String(userText||'').trim(),l=u.toLowerCase();
    if(['bad','sad','tired','stressed','rough','not good'].some(x=>l.includes(x)))return 'Sorry to hear that. I hope things get easier today.';
    if(intent==='location'){const p=extractKnownPlace(u);return p?`Nice, ${p}!`:'Nigeria has so many interesting places.'}
    if(intent==='music')return l.includes('gospel')?'Gospel music can be really uplifting.':l.includes('afro')||l.includes('burna')||l.includes('wizkid')||l.includes('davido')?'Nice choice — Afrobeats is popular here too.':'That sounds like a good mix.';
    if(intent==='food')return l.includes('jollof')||l.includes('suya')?'Good choice 😂 That sounds delicious.':'I would like to try that.';
    if(intent==='work')return 'That sounds interesting. Respect for what you’re doing.';
    if(intent==='hobby')return 'That sounds like a good way to spend your free time.';
    if(intent==='mood')return 'Glad to hear from you 😊';
    return u.length<4?'I understand.':'That makes sense.';
  }
  const CE_FOLLOWUPS={
    greeting:['How has your day been so far?'],mood:['What have you been doing today?'],location:['What do you like most about where you live?'],
    work:['What made you choose that?'],music:['Who is the artist you listen to the most?'],food:['Which Nigerian meal would you recommend to someone visiting?'],
    hobby:['Do you prefer staying home or going out?'],weather:['What do you normally do when the weather is like that?'],travel:['Which country would you like to visit first?'],
    family:['Are you the oldest or youngest in your family?'],time:['What usually keeps you awake around this time?'],relationship:['What qualities do you value most in people?'],
    general:['What do you enjoy doing during your free time?','What kind of music do you listen to?','What do you do for work or school?','What place would you love to visit?']
  };
  function ceNextTopic(partner,current){
    const key=`${ceIdentity()}:${partner}`,mem=ceConversationMemory[key]||(ceConversationMemory[key]=[]);if(current!=='general'&&!mem.includes(current))mem.push(current);
    const order=['mood','location','work','hobby','music','food','weather','travel','family'];const next=order.find(x=>!mem.includes(x))||'general';if(next!=='general')mem.push(next);return next;
  }

  window.contextualSuggestions=ceSuggestions;
  window.getNextReply=function(userText){
    const intent=ceIntent(lastPartnerMessage),questionAnswer=ceReplyToUserQuestion(userText),ack=ceAcknowledge(userText,intent),next=ceNextTopic(currentChatUser?.name||'partner',intent);
    const related=(CE_FOLLOWUPS[intent]||[])[0],fresh=(CE_FOLLOWUPS[next]||CE_FOLLOWUPS.general)[currentPartnerTurn%(CE_FOLLOWUPS[next]||CE_FOLLOWUPS.general).length];
    const follow=(currentPartnerTurn%3===0&&related)?related:fresh;
    return `${questionAnswer?questionAnswer+' ':''}${ack} ${follow}`.replace(/\s+/g,' ').trim();
  };

  function ceCreateChatOffer(){
    if(document.getElementById('ceChatOffer'))return;
    const el=document.createElement('div');el.id='ceChatOffer';el.className='ce-chat-offer';
    el.innerHTML='<button class="ce-chat-offer-close" aria-label="Close">×</button><div class="ce-chat-offer-icon">🎁</div><div class="ce-chat-offer-body"><div class="ce-chat-offer-title"></div><div class="ce-chat-offer-sub"></div></div><button class="ce-chat-offer-open"></button>';
    document.body.appendChild(el);el.querySelector('.ce-chat-offer-close').onclick=()=>{el.classList.remove('show');ceTrackOffer('dismissed','after_chat')};
    el.querySelector('.ce-chat-offer-open').onclick=(e)=>ceOpenOffer('after_chat',e);
  }
  function ceShowChatOffer(){
    if(!ceCurrentOffer||ceSessionMessageCount<3)return;ceCreateChatOffer();const el=document.getElementById('ceChatOffer');if(!el||el.dataset.shown===SESSION_ID)return;
    const active=document.querySelector('a.ce-offer-active')||document.querySelector('a[onclick*="dash_ad1"]');
    const texts=active?[...active.querySelectorAll('div')].map(x=>x.textContent.trim()).filter(Boolean):[];
    el.querySelector('.ce-chat-offer-title').textContent=texts.find(t=>t.length>5&&t.length<45)||"Claim Today's Bonus Offer";
    el.querySelector('.ce-chat-offer-sub').textContent=texts.find(t=>t.length>=20&&t.length<90)||'Exclusive reward for active users';
    el.querySelector('.ce-chat-offer-open').textContent=(active?.querySelector('span:last-child')?.textContent||'Open →').trim();
    el.dataset.shown=SESSION_ID;el.classList.add('show');ceRecordImpression('after_chat');
  }

  async function ceTrackShare(type,step=null,seconds=null,metadata={}){
    try{await supabaseClient.rpc('chatearn_v3_track_share_event',{
      p_event_type:type,p_visitor_id:VISITOR_ID,p_session_id:SESSION_ID,p_step:step,p_seconds_away:seconds,p_ref_code:ceProfileRef()||null,p_metadata:metadata
    })}catch(e){console.warn('Share event:',e?.message||e)}
  }

  function ceCreateWithdrawalStatus(){
    if(document.getElementById('ceWithdrawalStatus'))return;
    const el=document.createElement('div');el.id='ceWithdrawalStatus';el.className='ce-withdraw-status';el.innerHTML='<div class="ce-withdraw-status-title"></div><div class="ce-withdraw-status-sub"></div>';
    document.querySelector('.withdraw-teaser')?.after(el);
  }
  async function ceLoadWithdrawalStatus(){
    ceCreateWithdrawalStatus();const el=document.getElementById('ceWithdrawalStatus');if(!el||!currentUser){el?.classList.remove('show');return}
    try{const {data}=await supabaseClient.from('chatearn_withdrawals').select('amount,status,requested_at,reviewed_at,masked_account,bank').eq('user_id',currentUser.id).order('requested_at',{ascending:false}).limit(1);const w=data?.[0];if(!w){el.classList.remove('show');return}el.classList.add('show');const pill=`<span class="ce-status-pill ${w.status}">${esc(w.status)}</span>`;el.querySelector('.ce-withdraw-status-title').innerHTML=`Withdrawal ${pill}`;el.querySelector('.ce-withdraw-status-sub').textContent=`${money(w.amount)} · ${(w.bank||'').toUpperCase()} ${w.masked_account||''} · Submitted ${ceFmtDate(w.requested_at)}`;}catch(e){el.classList.remove('show')}
  }

  function ceAlignDynamicAmounts(){
    const amount=money(withdrawalAmount||Math.max(MIN_WITHDRAW,totalBalance));
    document.querySelectorAll('#kyc strong').forEach(x=>{if(/₦[\d,]+/.test(x.textContent))x.textContent=x.textContent.replace(/₦[\d,]+/,amount)});
    const kycBtn=document.querySelector('#kyc .btn-complete-kyc');if(kycBtn)kycBtn.textContent=kycBtn.textContent.replace(/₦[\d,]+/,amount);
  }

  // Wrap existing functions without changing the signup-to-chat flow.
  const ceOldGoScreen=window.goScreen;
  window.goScreen=function(id){const r=ceOldGoScreen(id);ceUpdateJourney();document.getElementById('ceStickyStart')?.classList.toggle('show',id==='landing'&&scrollY>260);if(id==='dashboard'){ceRenderReturnCard();ceLoadWithdrawalStatus();cePrepareOfferCards()}if(id==='sharewall')ceTrackShare('page_reached',swShares);if(id==='kyc')ceAlignDynamicAmounts();return r};

  const ceOldLoadProfile=window.loadProfile;
  window.loadProfile=async function(...args){const r=await ceOldLoadProfile(...args);ceRegisterVisit(false);ceRenderReturnCard();ceLoadWithdrawalStatus();return r};

  const ceOldRenderCards=window.renderConversationCards;
  window.renderConversationCards=async function(){const r=await ceOldRenderCards();ceEnhancePartnerCards();return r};

  const ceOldOpenChat=window.openChat;
  window.openChat=async function(idx){const r=await ceOldOpenChat(idx);document.getElementById('ceChatOffer')?.classList.remove('show');if(currentUser&&currentChatUser){supabaseClient.rpc('chatearn_v3_mark_thread_read',{p_partner_key:currentChatUser.name});if(CE_REF_CODE)supabaseClient.rpc('chatearn_v3_attach_referral',{p_ref_code:CE_REF_CODE,p_visitor_id:VISITOR_ID,p_session_id:SESSION_ID,p_event_type:'chat_started'})}if(ceLastShareOpenAt)ceTrackShare('resumed_chat',swShares,Math.round((Date.now()-ceLastShareOpenAt)/1000));return r};

  const ceOldTrackEvent=window.trackEvent;
  window.trackEvent=async function(name,metadata={}){const r=await ceOldTrackEvent(name,metadata);if(name==='user_message_sent'){ceSessionMessageCount++;if(ceOfferOpenState===null&&sessionStorage.getItem('ce_v3_offer_returned')){ceTrackOffer('continued','chat',null,{after_return:true});sessionStorage.removeItem('ce_v3_offer_returned')}if(ceSessionMessageCount>=3)setTimeout(ceShowChatOffer,500)}return r};

  const ceOldDoShare=window.doShareWA;
  window.doShareWA=function(){ceLastShareOpenAt=Date.now();ceLastShareStep=swShares+1;ceTrackShare('whatsapp_open',ceLastShareStep);const r=ceOldDoShare();setTimeout(()=>{const sec=Math.max(0,Math.round((Date.now()-ceLastShareOpenAt)/1000));ceTrackShare('return',swShares,sec,{progress:Math.round(swShares/REQ*100)});if(swShares>=REQ)ceTrackShare('completed',swShares,sec)},2100);return r};

  const ceOldGetMsg=window.getMsg;
  window.getMsg=function(){const original=ceOldGetMsg();const oldRef=currentUser?.id?encodeURIComponent(currentUser.id):'';const ref=encodeURIComponent(ceProfileRef());return oldRef&&ref?original.replaceAll(`?ref=${oldRef}`,`?ref=${ref}`):original};

  const ceOldPlaceWithdrawal=window.placeWithdrawal;
  window.placeWithdrawal=async function(){const r=await ceOldPlaceWithdrawal();setTimeout(()=>{ceAlignDynamicAmounts();ceTrackShare('continued_withdrawal',0)},250);return r};

  // Dedicated Admin authentication and V3 snapshot.
  window.openAdmin=function(){adminPreviousScreen=currentScreen;document.getElementById('adminShell')?.classList.add('show');currentScreen='admin';history.replaceState(null,'',location.pathname+location.search+'#admin');setAdminRealtimeState('connecting','Checking Admin V3 session…');checkAdminSession()};
  window.closeAdmin=function(){ceStopAdminRealtime();stopAdminLiveLoop();document.getElementById('adminShell')?.classList.remove('show');currentScreen=adminPreviousScreen||'landing';history.replaceState(null,'',location.pathname+location.search);updatePresence()};
  window.adminLogin=async function(){const email=byId('adminEmail')?.value.trim(),password=byId('adminPass')?.value,btn=byId('adminLoginBtn');if(!email||!password)return showAdminError('Enter the administrator email and password.');if(btn){btn.disabled=true;btn.textContent='Opening…'}try{const {error}=await ceAdminClient.auth.signInWithPassword({email,password});if(error)throw error;await checkAdminSession()}catch(e){showAdminError(e.message||String(e),true)}finally{if(btn){btn.disabled=false;btn.textContent='Open Admin Panel'}}};
  window.adminLogout=async function(){ceStopAdminRealtime();await ceAdminClient.auth.signOut();byId('adminLoginBox').style.display='block';byId('adminContent').style.display='none';setAdminRealtimeState('disconnected','Admin logged out')};
  window.checkAdminSession=async function(){try{const {data,error}=await ceAdminClient.auth.getSession();if(error)throw error;if(!data.session){byId('adminLoginBox').style.display='block';byId('adminContent').style.display='none';setAdminRealtimeState('disconnected','Admin login required');return}const {data:isAdmin,error:ae}=await ceAdminClient.rpc('chatearn_v3_admin_is_admin');if(ae)throw ae;if(!isAdmin)throw new Error('This account does not have administrator permission.');byId('adminLoginBox').style.display='none';byId('adminContent').style.display='block';setAdminTab('overview',document.querySelector('.admin-tab[data-tab="overview"]'));await refreshAdmin();ceSubscribeAdminRealtime();startAdminLiveLoop()}catch(e){byId('adminLoginBox').style.display='block';byId('adminContent').style.display='none';setAdminRealtimeState('disconnected','Admin authentication failed');showAdminError(e.message||String(e),true)}};

  let ceAdminLiveRefreshing=false,ceAdminLivePollHandle=null,ceAdminFullDebounce=null;

  function ceMergeRecentEvents(rows){
    const map=new Map((adminData.events||[]).map(e=>[String(e.id||`${e.session_id||''}:${e.event_name||''}:${e.created_at||''}`),e]));
    (rows||[]).forEach(e=>map.set(String(e.id||`${e.session_id||''}:${e.event_name||''}:${e.created_at||''}`),e));
    adminData.events=[...map.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,3500);
  }

  async function ceRefreshAdminLive(){
    if(ceAdminLiveRefreshing||!adminPanelIsOpen())return;
    ceAdminLiveRefreshing=true;
    try{
      let {data,error}=await ceAdminClient.rpc('chatearn_v3_admin_live_snapshot');
      if(error&&/jwt|auth|session/i.test(error.message||'')){await ceAdminClient.auth.refreshSession();({data,error}=await ceAdminClient.rpc('chatearn_v3_admin_live_snapshot'))}
      if(error)throw error;
      const p=typeof data==='string'?JSON.parse(data):data;
      if(!p?.ok||!p.data)throw new Error('Admin live snapshot returned an invalid response');
      adminData.presence=Array.isArray(p.data.presence)?p.data.presence:adminData.presence;
      ceMergeRecentEvents(Array.isArray(p.data.events)?p.data.events:[]);
      renderOverview();renderLive();
      adminLastRealtimeAt=Date.now();
      setAdminRealtimeState('connected','Realtime connected · lightweight live refresh');
      putText('adminLastUpdated',`Updated ${formatLagos(p.generated_at||Date.now())} WAT · live data`);
    }catch(e){
      if(!adminHasLoaded)showAdminError(e.message||String(e),true);
    }finally{ceAdminLiveRefreshing=false}
  }

  function ceApplyRealtimeRow(table,payload){
    const row=payload.new||payload.old;
    if(table==='chatearn_presence'){
      const rows=[...(adminData.presence||[])],key=row?.session_id,idx=rows.findIndex(x=>x.session_id===key);
      if(payload.eventType==='DELETE'){if(idx>=0)rows.splice(idx,1)}else if(idx>=0)rows[idx]=row;else if(row)rows.unshift(row);
      adminData.presence=rows.sort((a,b)=>new Date(b.last_seen_at)-new Date(a.last_seen_at)).slice(0,1500);
      renderOverview();renderLive();
      return true;
    }
    if(table==='chatearn_events'&&payload.new){ceMergeRecentEvents([payload.new]);renderOverview();renderLive();return true}
    return false;
  }

  function ceScheduleFullRefresh(delay=2500){
    clearTimeout(ceAdminFullDebounce);
    ceAdminFullDebounce=setTimeout(()=>refreshAdmin({silent:true,reason:'realtime'}),delay);
  }

  window.refreshAdmin=async function(options={}){
    const silent=!!options.silent;
    if(adminRefreshing){if(!silent)adminRefreshQueued=true;return}
    adminRefreshing=true;const btn=byId('adminRefreshBtn');if(btn&&!silent){btn.disabled=true;btn.textContent='Refreshing…'}
    try{
      let {data,error}=await ceAdminClient.rpc('chatearn_v3_admin_snapshot');
      if(error&&/jwt|auth|session/i.test(error.message||'')){await ceAdminClient.auth.refreshSession();({data,error}=await ceAdminClient.rpc('chatearn_v3_admin_snapshot'))}
      if(error)throw error;
      const p=typeof data==='string'?JSON.parse(data):data;if(!p?.ok||!p.data)throw new Error('Admin V3.2 returned an invalid response');
      const d=p.data;adminData={events:d.events||[],profiles:d.profiles||[],presence:d.presence||[],withdrawals:d.withdrawals||[],kyc:d.kyc||[],threads:d.threads||[],ledger:d.ledger||[],share_attempts:d.share_attempts||[],bank_checks:d.bank_checks||[],public_activity:d.public_activity||[],visits:d.visits||[],offers:d.offers||[],offer_events:d.offer_events||[],share_events:d.share_events||[],referrals:d.referrals||[],chat_messages:d.chat_messages||[]};
      adminHasLoaded=true;renderAllAdmin();putText('adminLastUpdated',`Updated ${formatLagos(p.generated_at||Date.now())} WAT · verified Admin V3.2 snapshot`);setAdminRealtimeState(adminRealtimeReady?'connected':'connecting',adminRealtimeReady?'Realtime connected · optimised Admin V3.2':'Admin V3.2 loaded · connecting realtime');clearAdminError();adminNextPollAt=Date.now()+ADMIN_POLL_MS;
    }catch(e){setAdminRealtimeState('disconnected',adminHasLoaded?'Refresh failed · last valid figures kept':'Admin V3.2 unavailable');showAdminError(e.message||String(e),true)}
    finally{adminRefreshing=false;if(btn&&!silent){btn.disabled=false;btn.textContent='Refresh'}if(adminRefreshQueued){adminRefreshQueued=false;setTimeout(()=>refreshAdmin({silent:true}),1000)}}
  };

  function ceStopAdminRealtime(){ceAdminChannelsV3.forEach(c=>ceAdminClient.removeChannel(c));ceAdminChannelsV3=[];adminRealtimeReady=false;if(ceAdminLivePollHandle)clearInterval(ceAdminLivePollHandle);ceAdminLivePollHandle=null;clearTimeout(ceAdminFullDebounce)}
  function ceSubscribeAdminRealtime(){
    ceStopAdminRealtime();
    const tables=['chatearn_events','chatearn_presence','chatearn_profiles','chatearn_chat_threads','chatearn_withdrawals','chatearn_kyc','chatearn_v3_visits','chatearn_v3_offer_events','chatearn_v3_share_events','chatearn_v3_referrals'];
    tables.forEach(table=>{
      const ch=ceAdminClient.channel('ce-v32-'+table+'-'+Date.now()).on('postgres_changes',{event:'*',schema:'public',table},payload=>{
        adminLastRealtimeAt=Date.now();
        if(!ceApplyRealtimeRow(table,payload))ceScheduleFullRefresh(2500);
      }).subscribe(status=>{if(status==='SUBSCRIBED'){adminRealtimeReady=true;setAdminRealtimeState('connected','Realtime connected · lightweight live refresh')}});
      ceAdminChannelsV3.push(ch)
    });
    ceAdminLivePollHandle=setInterval(()=>ceRefreshAdminLive(),10000);
    setTimeout(()=>ceRefreshAdminLive(),1000);
  }

  const ceOldRenderAll=window.renderAllAdmin;
  window.renderAllAdmin=function(){ceOldRenderAll();ceRenderOffersAdmin();ceExtendAdminOverview();ceExtendAdminInsights()};

  function ceEnsureOffersTab(){
    if(document.querySelector('.admin-tab[data-tab="offers"]'))return;
    const tab=document.createElement('button');tab.type='button';tab.className='admin-tab';tab.dataset.tab='offers';tab.textContent='Offers';tab.onclick=(e)=>adminSwitchTab(e,'offers',tab);
    const shares=document.querySelector('.admin-tab[data-tab="shares"]');shares?.after(tab);
    const panel=document.createElement('div');panel.className='admin-panel';panel.id='admin-offers';panel.innerHTML='<div class="admin-status-banner">Offer rotation, impressions, opens and returns. External completion is only counted when a provider postback is available.</div><div class="admin-grid" id="offerKpis"></div><div class="admin-section-title">Offer performance</div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Offer</th><th>Status</th><th>Impressions</th><th>Opens</th><th>Open rate</th><th>Returns</th><th>Avg away</th></tr></thead><tbody id="offersTable"></tbody></table></div>';
    document.getElementById('adminContent')?.appendChild(panel);
  }
  function ceRenderOffersAdmin(){ceEnsureOffersTab();const offers=adminData.offers||[],events=adminData.offer_events||[];const count=(k,t)=>events.filter(e=>e.offer_key===k&&e.event_type===t).length,uniq=(k,t)=>new Set(events.filter(e=>e.offer_key===k&&e.event_type===t).map(e=>e.visitor_id||e.user_id||e.session_id)).size;const impressions=events.filter(e=>e.event_type==='impression').length,opens=events.filter(e=>e.event_type==='open').length,returns=events.filter(e=>e.event_type==='return').length,returners=new Set((adminData.visits||[]).filter(v=>v.is_returning).map(v=>v.visitor_id)).size;putHtml('offerKpis',[kpi(impressions,'OFFER IMPRESSIONS'),kpi(opens,'OFFER OPENS'),kpi(returns,'OFFER RETURNS'),kpi(returners,'RETURNING BROWSERS')].join(''));putHtml('offersTable',offers.map(o=>{const im=uniq(o.offer_key,'impression'),op=uniq(o.offer_key,'open'),rt=uniq(o.offer_key,'return'),away=events.filter(e=>e.offer_key===o.offer_key&&e.event_type==='return'&&e.seconds_away!=null).map(e=>Number(e.seconds_away));return `<tr><td><b>${esc(o.name)}</b><br><span style="color:#7d8b82">${esc(o.offer_key)}</span></td><td class="${o.active&&o.url?'ce-admin-offer-good':'ce-admin-offer-warn'}">${o.active&&o.url?'Active':'Disabled'}</td><td>${im}</td><td>${op}</td><td>${im?Math.round(op/im*100):0}%</td><td>${rt}</td><td>${away.length?Math.round(away.reduce((a,b)=>a+b,0)/away.length)+'s':'—'}</td></tr>`}).join('')||'<tr><td colspan="7">No offers configured.</td></tr>')}

  function ceExtendAdminOverview(){
    const box=document.getElementById('overviewKpis');if(!box)return;const visits=adminData.visits||[],today=ceDateKey(),todayVisits=visits.filter(v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date(v.first_seen_at))===today),newV=new Set(todayVisits.filter(v=>!v.is_returning).map(v=>v.visitor_id)).size,retV=new Set(todayVisits.filter(v=>v.is_returning).map(v=>v.visitor_id)).size;box.insertAdjacentHTML('beforeend',kpi(newV,'NEW VISITORS TODAY')+kpi(retV,'RETURNING VISITORS TODAY'))
  }
  function ceExtendAdminInsights(){
    const list=document.getElementById('insightsList');if(!list)return;const ev=adminData.offer_events||[],vis=adminData.visits||[],imp=ev.filter(e=>e.event_type==='impression'),op=ev.filter(e=>e.event_type==='open'),ret=ev.filter(e=>e.event_type==='return');const byOffer=(adminData.offers||[]).map(o=>({name:o.name,im:imp.filter(e=>e.offer_key===o.offer_key).length,op:op.filter(e=>e.offer_key===o.offer_key).length,ret:ret.filter(e=>e.offer_key===o.offer_key).length})).filter(x=>x.im);const best=byOffer.sort((a,b)=>(b.op/(b.im||1))-(a.op/(a.im||1)))[0];let html='';if(best)html+=`<div class="admin-insight"><div class="admin-insight-title">Offer performance</div><div class="admin-insight-body">${esc(best.name)} currently has the strongest recorded open rate at ${Math.round(best.op/best.im*100)}%. Compare return rate before moving more visitors to it.</div></div>`;const returning=new Set(vis.filter(v=>v.is_returning).map(v=>v.visitor_id)).size,total=new Set(vis.map(v=>v.visitor_id)).size;if(total)html+=`<div class="admin-insight"><div class="admin-insight-title">Returning visitors</div><div class="admin-insight-body">${returning} of ${total} recorded browsers returned during the current reporting window. Offer rotation now separates repeat visits from first visits.</div></div>`;list.insertAdjacentHTML('beforeend',html)}

  window.reviewWithdrawal=async function(id,status,button){if(!confirm(status==='approved'?'Confirm that you have manually paid this withdrawal and want to approve it?':'Reject this withdrawal request?'))return;const note=status==='rejected'?(prompt('Reason for rejection (optional):')||'').trim():'';if(button){button.disabled=true;button.textContent=status==='approved'?'Approving…':'Rejecting…'}try{const {error}=await ceAdminClient.rpc('chatearn_v3_admin_review_withdrawal',{p_withdrawal_id:id,p_status:status,p_note:note||null});if(error)throw error;showToast(status==='approved'?'Withdrawal approved':'Withdrawal rejected');await refreshAdmin()}catch(e){showAdminError(e.message||String(e),true)}finally{if(button){button.disabled=false;button.textContent=status==='approved'?'Approve Paid':'Reject'}}};
  window.reviewKyc=async function(id,status,button){if(!confirm(status==='approved'?'Approve this KYC record?':'Reject this KYC record?'))return;const note=status==='rejected'?(prompt('Reason for rejection (optional):')||'').trim():'';if(button){button.disabled=true;button.textContent=status==='approved'?'Approving…':'Rejecting…'}try{const {error}=await ceAdminClient.rpc('chatearn_v3_admin_review_kyc',{p_kyc_id:id,p_status:status,p_note:note||null});if(error)throw error;showToast(status==='approved'?'KYC approved':'KYC rejected');await refreshAdmin()}catch(e){showAdminError(e.message||String(e),true)}finally{if(button){button.disabled=false;button.textContent=status==='approved'?'Approve':'Reject'}}};

  function ceInitialise(){
    ceOptimizeLandingOrder();ceCreateStickyStart();ceCreateJourney();ceCreateReturnCard();ceCreateChatOffer();ceCreateWithdrawalStatus();ceEnhancePartnerCards();ceEnsureOffersTab();
    const version=document.querySelector('.admin-brand small');if(version)version.textContent='v3.2';
    ceRegisterVisit();
    supabaseClient.auth.onAuthStateChange(()=>setTimeout(()=>ceRegisterVisit(),250));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){ceHandleOfferReturn().then(done=>{if(done)sessionStorage.setItem('ce_v3_offer_returned','1')});if(ceLastShareOpenAt){const sec=Math.round((Date.now()-ceLastShareOpenAt)/1000);ceTrackShare('return',ceLastShareStep,sec)}}});
    window.addEventListener('pageshow',()=>ceHandleOfferReturn());
    // Full Admin data is refreshed by the main 60-second loop; live presence uses a lightweight 10-second RPC.
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ceInitialise,{once:true});else ceInitialise();
})();
