import fs from 'node:fs';

const appPath = 'assets/js/chatearn-app.js';
const indexPath = 'index.html';

let app = fs.readFileSync(appPath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');

const oldRegister = `    let {data,error}=await supabaseClient.auth.signUp({email,password:pass,options:{data:{full_name:name}}});
    if(error)throw error;
    if(!data.session){
      const login=await supabaseClient.auth.signInWithPassword({email,password:pass});
      if(login.error)throw new Error('Account created, but automatic login is unavailable. Turn off email confirmation in Supabase Auth settings.');
      data=login.data;
    }
    currentUser=data.user;`;

const newRegister = `    let {data,error}=await supabaseClient.auth.signUp({email,password:pass,options:{data:{full_name:name}}});
    if(error)throw error;
    if(!data?.session){
      const login=await supabaseClient.auth.signInWithPassword({email,password:pass});
      if(login.error)throw new Error('Account created, but login could not start. Confirm the email or disable email confirmation in Supabase Auth.');
      data=login.data;
    }
    const verified=await supabaseClient.auth.getSession();
    if(verified.error)throw verified.error;
    if(!verified.data?.session?.user)throw new Error('Account created, but no active login session was established.');
    currentUser=verified.data.session.user;`;

if (!app.includes(newRegister)) {
  if (!app.includes(oldRegister)) throw new Error('Registration auth block not found');
  app = app.replace(oldRegister, newRegister);
}

const oldLogin = `    const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error)throw error;
    currentUser=data.user;`;

const newLogin = `    const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error)throw error;
    const verified=await supabaseClient.auth.getSession();
    if(verified.error)throw verified.error;
    if(!verified.data?.session?.user)throw new Error('Login succeeded, but no active session was established. Please try again.');
    currentUser=verified.data.session.user;`;

if (!app.includes(newLogin)) {
  if (!app.includes(oldLogin)) throw new Error('Login auth block not found');
  app = app.replace(oldLogin, newLogin);
}

const oldAutoChat = `      goScreen('dashboard');document.getElementById('dashName').textContent=userName+'!';updateBalance();trackEvent('dashboard_reached');const pickIdx=Math.floor(Math.random()*FOREIGNERS.length);setTimeout(()=>openChat(pickIdx),650)`;
const newAutoChat = `      goScreen('dashboard');document.getElementById('dashName').textContent=userName+'!';updateBalance();trackEvent('dashboard_reached');supabaseClient.auth.getSession().then(({data})=>{if(data?.session?.user){const pickIdx=Math.floor(Math.random()*FOREIGNERS.length);setTimeout(()=>openChat(pickIdx),650)}else{showToast('Please log in to begin chatting.')}})`;

if (!app.includes(newAutoChat)) {
  if (!app.includes(oldAutoChat)) throw new Error('Auto-chat block not found');
  app = app.replace(oldAutoChat, newAutoChat);
}

index = index.replace('chatearn-auth-session-fix.js?v=8.0.1', 'chatearn-auth-session-fix.js?v=8.0.3');

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
console.log('Applied Module 8 auth hard fix');
