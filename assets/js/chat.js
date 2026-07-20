(() => {
  'use strict';
  if (window.__CHAT_EARN_FRONTEND_CHAT__) return;
  window.__CHAT_EARN_FRONTEND_CHAT__ = true;

  const partners = [
    {
      key: 'alexlab102', name: 'Alex', flag: '🇺🇸', rate: 15000,
      opener: 'Hey, how is your day going?',
      replies: ['That sounds interesting. What happened next?', 'Nice! Tell me more about that.', 'I understand. How did that make you feel?', 'What do you enjoy most about it?']
    },
    {
      key: 'emiliacute', name: 'Emilia', flag: '🇬🇧', rate: 12000,
      opener: 'Hi! Tell me something interesting about yourself.',
      replies: ['That is lovely. What else should I know about you?', 'Interesting! How long have you been doing that?', 'What would you like to achieve next?', 'I would like to hear more.']
    },
    {
      key: 'mattjohn', name: 'Matt', flag: '🇨🇦', rate: 10000,
      opener: 'Hello! What are you working on today?',
      replies: ['That sounds productive. What is the goal?', 'How is the progress going so far?', 'What is the most difficult part?', 'Great. What will you do after that?']
    },
    {
      key: 'abi1990', name: 'Abi', flag: '🇿🇦', rate: 15000,
      opener: 'Hey there! What do you enjoy doing?',
      replies: ['That sounds fun. Why do you enjoy it?', 'How often do you do that?', 'Who introduced you to it?', 'What else do you enjoy?']
    },
    {
      key: 'princess77', name: 'Princess', flag: '🇦🇺', rate: 8000,
      opener: 'Hi! What is life like where you are?',
      replies: ['That is interesting. What is your favourite part?', 'What do people usually do there?', 'I would love to know more about your city.', 'How is the weather there today?']
    },
    {
      key: 'camilaanders', name: 'Camila', flag: '🇪🇸', rate: 10000,
      opener: 'Hello! What would you like to talk about?',
      replies: ['Sure, let us talk about that.', 'What is your own opinion about it?', 'That makes sense. Can you explain more?', 'What made you think about that today?']
    }
  ];

  // Edit ads here. mode: "fixed" always uses fixedAdSlot; mode: "random" rotates in chat.
  const ads = [
    {
      id: 'fixed-main', mode: 'fixed', active: true,
      title: 'Sponsored Opportunity',
      description: 'Open this sponsored offer in a new tab.',
      cta: 'Open Now',
      url: 'https://example.com'
    },
    {
      id: 'random-one', mode: 'random', active: true,
      title: 'Discover More',
      description: 'A sponsored recommendation selected for this conversation.',
      cta: 'View Offer',
      url: 'https://example.com'
    }
  ];

  let activePartner = null;
  let replyIndex = 0;
  let sending = false;
  let currentUserId = null;

  const money = value => `₦${Number(value || 0).toLocaleString('en-NG')}`;
  const keyFor = suffix => `ce_frontend_${currentUserId || 'guest'}_${suffix}`;
  const readNumber = suffix => Math.max(0, Number(localStorage.getItem(keyFor(suffix)) || 0));
  const writeNumber = (suffix, value) => localStorage.setItem(keyFor(suffix), String(Math.max(0, Number(value) || 0)));

  function show(id) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAccountState() {
    document.getElementById('balance').textContent = money(readNumber('balance'));
    document.getElementById('chatCount').textContent = readNumber('replies').toLocaleString('en-NG');
  }

  function renderPartners() {
    const list = document.getElementById('partnerList');
    if (!list) return;
    list.innerHTML = partners.map(partner => `
      <button class="partner" type="button" data-partner="${partner.key}">
        <span class="avatar">${partner.flag}</span>
        <span class="partner-copy"><b>${partner.name}</b><small>Guided chat partner</small></span>
        <span class="partner-rate">${money(partner.rate)}/reply</span>
      </button>
    `).join('');
    list.querySelectorAll('[data-partner]').forEach(button => {
      button.addEventListener('click', () => openChat(button.dataset.partner));
    });
  }

  function adMarkup(ad) {
    if (!ad || ad.active === false || !/^https:\/\//i.test(ad.url)) return '';
    return `<article class="ad-card"><small>SPONSORED</small><h4>${escapeHtml(ad.title)}</h4><p>${escapeHtml(ad.description)}</p><a href="${escapeAttribute(ad.url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(ad.cta)}</a></article>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function renderFixedAd() {
    const slot = document.getElementById('fixedAdSlot');
    if (!slot) return;
    slot.innerHTML = adMarkup(ads.find(ad => ad.active !== false && ad.mode === 'fixed'));
  }

  function renderRandomAd() {
    const slot = document.getElementById('randomAdSlot');
    if (!slot) return;
    const pool = ads.filter(ad => ad.active !== false && ad.mode === 'random');
    const ad = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    slot.innerHTML = adMarkup(ad);
  }

  function addMessage(text, type, reward = 0) {
    const messages = document.getElementById('messages');
    const bubble = document.createElement('div');
    bubble.className = `bubble ${type}`;
    bubble.textContent = text;
    if (reward > 0) {
      const earn = document.createElement('span');
      earn.className = 'earn';
      earn.textContent = `+${money(reward)}`;
      bubble.appendChild(earn);
    }
    messages.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function openChat(key) {
    activePartner = partners.find(partner => partner.key === key) || partners[0];
    replyIndex = 0;
    document.getElementById('chatName').textContent = activePartner.name;
    document.getElementById('chatAvatar').textContent = activePartner.flag;
    document.getElementById('chatStatus').textContent = 'Guided chat partner';
    document.getElementById('chatRate').textContent = `${money(activePartner.rate)}/reply`;
    document.getElementById('messages').innerHTML = '';
    addMessage(activePartner.opener, 'in');
    renderRandomAd();
    show('chat');
    document.getElementById('chatInput').focus();
  }

  function typingIndicator(showIndicator) {
    let indicator = document.getElementById('typingIndicator');
    if (showIndicator && !indicator) {
      indicator = document.createElement('div');
      indicator.id = 'typingIndicator';
      indicator.className = 'typing';
      indicator.textContent = `${activePartner.name} is typing…`;
      document.getElementById('messages').appendChild(indicator);
      indicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (!showIndicator) {
      indicator?.remove();
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (sending || !activePartner || !currentUserId) return;

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    sending = true;
    input.disabled = true;
    input.value = '';
    addMessage(message, 'out', activePartner.rate);

    const nextBalance = readNumber('balance') + activePartner.rate;
    const nextReplies = readNumber('replies') + 1;
    writeNumber('balance', nextBalance);
    writeNumber('replies', nextReplies);
    renderAccountState();

    if (nextReplies % 3 === 0) renderRandomAd();

    typingIndicator(true);
    await new Promise(resolve => setTimeout(resolve, 700));
    typingIndicator(false);
    addMessage(activePartner.replies[replyIndex % activePartner.replies.length], 'in');
    replyIndex += 1;

    sending = false;
    input.disabled = false;
    input.focus();
  }

  function onUserReady(event) {
    currentUserId = event.detail?.user?.id || document.body.dataset.userId || null;
    renderAccountState();
    renderPartners();
    renderFixedAd();
  }

  function boot() {
    document.getElementById('chatBack')?.addEventListener('click', () => show('dashboard'));
    document.getElementById('composer')?.addEventListener('submit', sendMessage);
    window.addEventListener('chatearn:user-ready', onUserReady);

    if (document.body.dataset.userId) {
      onUserReady({ detail: { user: { id: document.body.dataset.userId } } });
    } else {
      renderPartners();
      renderFixedAd();
    }
  }

  window.addEventListener('chatearn:ready', boot, { once: true });
})();