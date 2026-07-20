(() => {
 const money=n=>'₦'+Number(n||0).toLocaleString('en-NG');
 const css=document.createElement('link');css.rel='stylesheet';css.href='./assets/css/chat.css?v=1';document.head.appendChild(css);
 function mount(){
  const dash=document.getElementById('dashboard');if(!dash||document.getElementById('cePartnerList'))return;
  const section=document.createElement('section');section.className='ce-partners';section.innerHTML='<small>AVAILABLE NOW</small><h3>Choose a chat partner</h3><div id="cePartnerList" class="ce-partner-list"></div>';dash.appendChild(section);
  const chat=document.createElement('section');chat.id='ceChat';chat.className='ce-chat';chat.innerHTML='<div class="ce-chat-inner"><header class="ce-chat-head"><button id="ceChatBack" class="ce-back" type="button">←</button><div id="ceChatAvatar" class="ce-avatar">A</div><div class="ce-chat-name"><b id="ceChatName">Partner</b><span>● Online now</span></div><div id="ceChatBalance" class="ce-live-balance">₦0</div></header><div id="ceMessages" class="ce-messages"></div><div id="ceReplies" class="ce-replies"></div><form id="ceChatForm" class="ce-compose"><input id="ceChatInput" maxlength="1500" autocomplete="off" placeholder="Type a message…"><button id="ceSend" type="submit">➤</button></form></div>';document.body.appendChild(chat);
  const list=document.getElementById('cePartnerList');list.innerHTML=window.ChatEarnPartners.map(p=>`<button class="ce-partner" data-ce-partner="${p.slug}"><span class="ce-avatar">${p.avatar}</span><span><b>${p.name}</b><em>Online • Earn up to ${money(p.rate)}</em></span><strong>›</strong></button>`).join('');
  window.dispatchEvent(new Event('chatearn:chat-ui-ready'));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 window.ChatEarnChatUI=Object.freeze({mount,money});
})();