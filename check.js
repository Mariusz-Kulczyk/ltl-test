
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(async function(){
'use strict';

const firebaseConfig={
  apiKey:"AIzaSyC9yiuqb9N1lXr95aPp8Jd70mPJDIdtsZA",
  authDomain:"strona-internweo.firebaseapp.com",
  projectId:"strona-internweo",
  storageBucket:"strona-internweo.firebasestorage.app",
  messagingSenderId:"399902055690",
  appId:"1:399902055690:web:025a3fa20e607cd9b6eef3",
  measurementId:"G-2JY2R3VYN4"
};
const ADMIN_EMAIL='contact@mkulczyk.pl';
let fbApp=null,fbAuth=null,fbDb=null,authUser=null,authReady=null,cloudOnline=false,cloudBusy=false,cloudSaveTimer=null;
const cloudDeleted={requests:new Set(),notifications:new Set(),clients:new Set()};
try{
  fbApp=initializeApp(firebaseConfig);
  fbAuth=getAuth(fbApp);
  fbDb=getFirestore(fbApp);
  authReady=new Promise(resolve=>onAuthStateChanged(fbAuth,async user=>{
    authUser=user;
    if(user){
      try{localStorage.setItem('mkFirebaseAuthEmail',user.email||'');}catch(e){}
      if(typeof setCurrentFromAuthEmail==='function')setCurrentFromAuthEmail(user.email||'');
      if(document.querySelector('#app')){
        try{await loadCloudData();}catch(e){}
        if(typeof render==='function')render();
      }
    }else{
      try{localStorage.removeItem('mkFirebaseAuthEmail');}catch(e){}
    }
    resolve(user);
  }));
  cloudOnline=true;
}catch(firebaseInitError){console.warn('Firebase init error',firebaseInitError);}
const ADMIN={id:'admin',role:'admin',company:'M. KULCZYK',companyCode:'MK',name:'Mariusz Kulczyk',contact:'Mariusz Kulczyk',email:'contact@mkulczyk.pl',phone:'',login:'contact@mkulczyk.pl',accessCode:'123',language:'pl',vatEu:''};
const defaults={admin:structuredClone(ADMIN),clients:[
  {id:'testclient',role:'client',company:'Test Client',companyCode:'TC',vatEu:'',language:'pl',name:'Klient Testowy',contact:'Klient Testowy',email:'test@mkulczyk.pl',phone:'+48 500 100 100',login:'test',accessCode:'123'},
  {id:'nordcargo',role:'client',company:'NordCargo',companyCode:'NC',vatEu:'',language:'pl',name:'Anna Nowak',contact:'Anna Nowak',email:'nord@mkulczyk.pl',phone:'+48 600 700 800',login:'nord',accessCode:'123'}
],requests:[],notifications:[],notifyEmail:'contact@mkulczyk.pl',currency:'PLN',notifyBrowser:false};
const state={admin:structuredClone(defaults.admin),clients:structuredClone(defaults.clients),requests:[],notifications:[],notifyEmail:defaults.notifyEmail,currency:defaults.currency,notifyBrowser:false,current:null,view:'loads',lang:'pl'};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=t=>{const el=$('#toast');el.textContent=t;el.className='toast show';setTimeout(()=>el.className='toast',3200)};
const statusLabels={
  pl:{draft:'Uzupełnij dane',waiting:'Oczekujące',budget:'Cena do potwierdzenia',budgetAccepted:'Cena potwierdzona',counter:'Negocjacje cenowe',searching:'Oferta w przygotowaniu',offer:'Oferta wysłana',accepted:'W realizacji',cancelled:'Odrzucono',archived:'Archiwum',finalized:'Zrealizowano'},
  en:{draft:'Complete details',waiting:'Pending',budget:'Price to confirm',budgetAccepted:'Price confirmed',counter:'Price negotiation',searching:'Offer in preparation',offer:'Offer sent',accepted:'In progress',cancelled:'Rejected',archived:'Archive',finalized:'Completed'},
  de:{draft:'Daten ergänzen',waiting:'Wartend',budget:'Preis zu bestätigen',budgetAccepted:'Preis bestätigt',counter:'Preisverhandlung',searching:'Angebot in Vorbereitung',offer:'Angebot gesendet',accepted:'In Durchführung',cancelled:'Abgelehnt',archived:'Archiv',finalized:'Abgeschlossen'}
};
const statusLabel=s=>((statusLabels[state.lang]||statusLabels.pl)[s]||statusLabels.pl[s]||s);
const reqLabels={ramp:'Wysokość rampowa',gps:'GPS',adr:'ADR',gdp:'GDP',waste:'Odpady',temperature:'Temperatura kontrolowana'};
const routeNames={loads:'Załadunek',stops:'Punkt pośredni',unloads:'Rozładunek'};
const countryOptions=[
  ['PL','Polska'],['DE','Niemcy'],['CZ','Czechy'],['SK','Słowacja'],['LT','Litwa'],['LV','Łotwa'],['EE','Estonia'],['NL','Niderlandy'],['BE','Belgia'],['LU','Luksemburg'],['FR','Francja'],['ES','Hiszpania'],['PT','Portugalia'],['IT','Włochy'],['AT','Austria'],['CH','Szwajcaria'],['DK','Dania'],['SE','Szwecja'],['NO','Norwegia'],['FI','Finlandia'],['GB','Wielka Brytania'],['IE','Irlandia'],['HU','Węgry'],['RO','Rumunia'],['BG','Bułgaria'],['GR','Grecja'],['SI','Słowenia'],['HR','Chorwacja'],['RS','Serbia'],['UA','Ukraina'],['TR','Turcja']
];
function normalizeCountryCode(v){
  const raw=String(v||'').trim();if(!raw)return '';
  const upper=raw.toUpperCase();
  const byCode=countryOptions.find(([code])=>code===upper);if(byCode)return byCode[0];
  const codeInText=upper.match(/(?:^|[^A-Z])([A-Z]{2})(?:$|[^A-Z])/);if(codeInText){const hit=countryOptions.find(([code])=>code===codeInText[1]);if(hit)return hit[0]}
  const cleaned=raw.toLocaleLowerCase('pl-PL').replace(/\s+/g,' ').trim();
  const byName=countryOptions.find(([,name])=>name.toLocaleLowerCase('pl-PL')===cleaned);if(byName)return byName[0];
  return '';
}
function countryOptionsMarkup(){return ''}
function countryMenuMarkup(){return `<div class="country-menu" data-country-menu>${countryOptions.map(([code,name])=>`<button type="button" class="country-option" data-country-code="${code}"><b>${code}</b><span>${name}</span></button>`).join('')}</div>`}

  const tableUi={admin:{query:'',key:'createdAt',dir:'desc'},client:{query:'',key:'createdAt',dir:'desc'},accounts:{query:'',key:'company',dir:'asc'}};
  const langs={pl:{code:'pl',label:'PL',flag:'https://flagcdn.com/w20/pl.png'},en:{code:'en',label:'EN',flag:'https://flagcdn.com/w20/gb.png'},de:{code:'de',label:'DE',flag:'https://flagcdn.com/w20/de.png'}};
  function langButtons(){return `<div class="lang-switch" aria-label="Wersje językowe">${Object.values(langs).map(l=>`<button type="button" class="lang-btn ${state.lang===l.code?'active':''}" data-lang="${l.code}" title="${l.label}"><img src="${l.flag}" alt="${l.label}"></button>`).join('')}</div>`}
  function normalizedLdm(v){
    const raw=String(v||'').trim().replace(/\s+/g,'').replace(/m$/i,'');
    if(!raw)return '';
    const dot=raw.replace(',','.');
    return /^\d+(?:\.\d+)?$/.test(dot)?dot.replace('.',','):raw;
  }
  function ldmDisplay(v){const clean=normalizedLdm(v);return clean?`${clean}m`:''}
  function accessValues(v){return String(v||'').split(/[,;|]/).map(x=>x.trim()).filter(Boolean)}
  function formatRegisteredAt(v){
    const d=new Date(v);if(Number.isNaN(d.getTime()))return '—';
    const p=n=>String(n).padStart(2,'0');const yy=String(d.getFullYear()).slice(-2);
    return `${p(d.getDate())}.${p(d.getMonth()+1)}.${yy} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function registeredCell(r){const text=formatRegisteredAt(r.createdAt);return `<td class="registered-cell"><b title="${esc(text)}">${esc(text)}</b></td>`}
  function requestSearchText(r,c={}){
    const route=[...(r.loads||[]),...(r.stops||[]),...(r.unloads||[])].map(p=>`${p.address||''} ${p.postalCity||''}`).join(' ');
    return [r.code,c.company,c.contact,route,r.ldm,r.weight,r.access,r.notes,r.clientNote,requirementsText(r),statusLabel(r.status),formatRegisteredAt(r.createdAt)].join(' ').toLocaleLowerCase('pl-PL');
  }
  function sortValue(r,key){
    const c=getClient(r.clientId)||{};
    if(key==='createdAt')return new Date(r.createdAt||0).getTime()||0;
    if(key==='code')return r.code||'';
    if(key==='client')return `${c.company||''} ${c.contact||''}`;
    if(key==='route')return routePoints(r).map(x=>x.p.postalCity||x.p.address||'').join(' ');
    if(key==='cargo')return `${normalizedLdm(r.ldm)} ${r.weight||''} ${r.access||''}`;
    if(key==='details')return `${requirementsText(r)} ${r.clientNote||''}`;
    if(key==='budget')return Number(String(r.budget||'').replace(',','.'))||0;
    if(key==='status')return statusLabel(r.status);
    return '';
  }
  function sortedRequests(rows,role){
    const ui=tableUi[role],collator=new Intl.Collator('pl',{numeric:true,sensitivity:'base'});
    return [...rows].sort((a,b)=>{const av=sortValue(a,ui.key),bv=sortValue(b,ui.key);const result=typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av),String(bv));return result*(ui.dir==='asc'?1:-1)});
  }
  function sortIndicator(role,key){const ui=tableUi[role];return ui.key===key?(ui.dir==='asc'?'↑':'↓'):''}
  function sortHead(label,key,role){return `<button type="button" class="table-sort-head" data-sort-key="${key}" data-sort-role="${role}" aria-label="Sortuj po: ${esc(label)}">${esc(label)} <span>${sortIndicator(role,key)}</span></button>`}
  function tableToolbar(role){
    const u=tableUi[role];
    return `<div class="table-toolbar"><label class="table-search"><span>${esc(ui('search'))}</span><input type="search" data-table-search="${role}" value="${esc(u.query)}" placeholder="${esc(ui('searchPlaceholder'))}"></label><div class="table-sort-actions"><span>${esc(ui('sort'))}</span>${[['createdAt',ui('date')],['code',ui('no')],['status',ui('status')]].map(([key,label])=>`<button type="button" class="sort-chip ${u.key===key?'active':''}" data-sort-key="${key}" data-sort-role="${role}">${esc(label)} ${sortIndicator(role,key)}</button>`).join('')}</div></div>`;
  }
  function applyTableSearch(role,query){
    const needle=String(query||'').trim().toLocaleLowerCase('pl-PL');
    document.querySelectorAll(`tr.request-row[data-table-role="${role}"]`).forEach(row=>{
      const visible=!needle||String(row.dataset.search||'').includes(needle);
      row.classList.toggle('row-filtered',!visible);
      const related=document.querySelector(`tr[data-proposal-for="${row.dataset.requestId}"]`);if(related)related.classList.toggle('row-filtered',!visible);
    });
  }
  function wizardAccessMarkup(selected){
    const current=new Set(accessValues(selected));
    return `<fieldset id="wizAccessGroup" class="wizard-access-group"><legend>Strona ładowania <b class="required-mark">*</b></legend><div>${['Bok','Góra','Tył'].map(x=>`<label><input type="checkbox" name="wizAccess" value="${x}" ${current.has(x)?'checked':''}><span>${x}</span></label>`).join('')}</div></fieldset>`;
  }

function ensureDefaultClients(){
  state.admin={...structuredClone(defaults.admin),...(state.admin||{})};
  const existing=new Set(state.clients.map(c=>c.id));
  defaults.clients.forEach(def=>{if(!existing.has(def.id))state.clients.push(structuredClone(def));});
  state.clients.forEach(c=>{const def=defaults.clients.find(x=>x.id===c.id)||{};c.role='client';c.login=c.login||def.login||c.email||c.id;c.accessCode=c.accessCode||def.accessCode||'123';c.companyCode=c.companyCode||def.companyCode||String(c.company||'KL').slice(0,2).toUpperCase();c.email=c.email||def.email||'';c.contact=c.contact||def.contact||c.name||'';c.name=c.name||def.name||c.contact||'';c.phone=c.phone||def.phone||'';c.vatEu=c.vatEu||def.vatEu||'';c.language=c.language||def.language||'pl';});
}
function localSnapshot(){return {admin:state.admin,clients:state.clients,requests:state.requests,notifications:state.notifications,notifyEmail:state.notifyEmail,currency:state.currency,lang:state.lang,notifyBrowser:state.notifyBrowser}}
function saveLocal(){try{localStorage.setItem('mkLtlModelV44FirebaseBackup',JSON.stringify(localSnapshot()));localStorage.setItem('mkLtlModelV23',JSON.stringify(localSnapshot()));}catch(e){}}
function plain(obj){return JSON.parse(JSON.stringify(obj||{}));}
function loginAlias(v){const raw=String(v||'').trim();const key=normalizeLogin(raw);return ({test:'test@mkulczyk.pl',nord:'nord@mkulczyk.pl','nordcargo':'nord@mkulczyk.pl'}[key]||raw)}
function isAdminEmail(email){return normalizeLogin(email)===normalizeLogin(ADMIN_EMAIL)}
function setCurrentFromAuthEmail(email){
  const normalized=normalizeLogin(email||'');
  if(!normalized)return false;
  if(isAdminEmail(normalized)){
    state.current=state.admin;
    state.view='loads';
    return true;
  }
  let client=state.clients.find(c=>normalizeLogin(c.email)===normalized||normalizeLogin(c.login)===normalized);
  if(!client){
    client={id:'client_'+normalized.replace(/[^a-z0-9]+/g,'_'),role:'client',company:email||'Klient',companyCode:'KL',vatEu:'',language:state.lang||'pl',name:email||'Klient',contact:email||'',email:email||'',phone:'',login:email||'',accessCode:''};
    state.clients=[...state.clients.filter(c=>c.email),client];
  }
  client.role='client';
  state.current=client;
  state.view='loads';
  return true;
}
function syncLoggedInSession(){
  const email=(authUser?.email)||(fbAuth?.currentUser?.email)||(()=>{try{return localStorage.getItem('mkFirebaseAuthEmail')||''}catch(e){return ''}})();
  if(email&&!state.current)return setCurrentFromAuthEmail(email);
  return Boolean(state.current);
}
function withClientEmail(r){const c=getClient(r.clientId)||{};return {...plain(r),clientEmail:r.clientEmail||c.email||''}}
async function docsToArray(q){const snap=await getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()}));}
async function loadCloudData(){
  if(!cloudOnline||!fbAuth?.currentUser||!fbDb)return false;
  const email=normalizeLogin(fbAuth.currentUser.email||'');
  const isAdmin=isAdminEmail(email);
  try{
    if(isAdmin){
      const [adminDoc,settingsDoc,clients,requests,notifications]=await Promise.all([
        getDoc(doc(fbDb,'admin','profile')),
        getDoc(doc(fbDb,'settings','global')),
        docsToArray(collection(fbDb,'clients')),
        docsToArray(collection(fbDb,'requests')),
        docsToArray(collection(fbDb,'notifications'))
      ]);
      if(adminDoc.exists())state.admin={...state.admin,...adminDoc.data(),role:'admin'};
      if(settingsDoc.exists()){const x=settingsDoc.data();state.notifyEmail=x.notifyEmail||state.notifyEmail;state.currency=x.currency||state.currency;state.notifyBrowser=Boolean(x.notifyBrowser);}
      state.clients=clients.length?clients.map(c=>({...c,role:'client'})):structuredClone(defaults.clients);
      state.requests=Array.isArray(requests)?requests:[];
      state.notifications=Array.isArray(notifications)?notifications:[];
      ensureDefaultClients();
      state.current=state.admin;
      state.view='loads';
      if(!clients.length)store();
    }else{
      const clients=await docsToArray(query(collection(fbDb,'clients'),where('email','==',fbAuth.currentUser.email||'')));
      const client=clients[0]||{id:'client_'+fbAuth.currentUser.uid,role:'client',company:fbAuth.currentUser.email||'Klient',companyCode:'KL',vatEu:'',language:'pl',name:fbAuth.currentUser.email||'Klient',contact:fbAuth.currentUser.email||'',email:fbAuth.currentUser.email||'',phone:'',login:fbAuth.currentUser.email||'',accessCode:''};
      state.clients=[{...client,role:'client'}];
      state.current=state.clients[0];
      state.requests=await docsToArray(query(collection(fbDb,'requests'),where('clientEmail','==',fbAuth.currentUser.email||'')));
      state.notifications=[];
      state.view='loads';
    }
    state.requests.forEach(normalizeRequest);
    saveLocal();
    return true;
  }catch(err){console.warn('Firebase load error',err);setCurrentFromAuthEmail(fbAuth?.currentUser?.email||'');return false;}
}
async function cloudSaveNow(){
  if(!cloudOnline||!fbAuth?.currentUser||!fbDb||cloudBusy)return;
  cloudBusy=true;
  try{
    const email=normalizeLogin(fbAuth.currentUser.email||'');
    const isAdmin=isAdminEmail(email);
    const batch=writeBatch(fbDb);
    if(isAdmin){
      batch.set(doc(fbDb,'admin','profile'),plain({...state.admin,role:'admin'}),{merge:true});
      batch.set(doc(fbDb,'settings','global'),plain({notifyEmail:state.notifyEmail,currency:state.currency,notifyBrowser:state.notifyBrowser}),{merge:true});
      state.clients.forEach(c=>batch.set(doc(fbDb,'clients',c.id),plain({...c,role:'client'}),{merge:true}));
      state.requests.forEach(r=>batch.set(doc(fbDb,'requests',r.id),withClientEmail(r),{merge:true}));
      state.notifications.forEach(n=>batch.set(doc(fbDb,'notifications',n.id),plain(n),{merge:true}));
      cloudDeleted.requests.forEach(id=>batch.delete(doc(fbDb,'requests',id)));
      cloudDeleted.notifications.forEach(id=>batch.delete(doc(fbDb,'notifications',id)));
      cloudDeleted.clients.forEach(id=>batch.delete(doc(fbDb,'clients',id)));
    }else{
      state.requests.filter(r=>normalizeLogin(r.clientEmail||getClient(r.clientId)?.email)===email).forEach(r=>batch.set(doc(fbDb,'requests',r.id),withClientEmail(r),{merge:true}));
      state.notifications.filter(n=>normalizeLogin(n.clientEmail)===email).forEach(n=>batch.set(doc(fbDb,'notifications',n.id),plain(n),{merge:true}));
    }
    await batch.commit();
    cloudDeleted.requests.clear();cloudDeleted.notifications.clear();cloudDeleted.clients.clear();
  }catch(err){console.warn('Firebase save error',err);}
  finally{cloudBusy=false;}
}
function store(){saveLocal();if(cloudSaveTimer)clearTimeout(cloudSaveTimer);cloudSaveTimer=setTimeout(cloudSaveNow,250);}
async function load(){
  try{const raw=localStorage.getItem('mkLtlModelV44FirebaseBackup')||localStorage.getItem('mkLtlModelV23')||localStorage.getItem('mkLtlModelV17')||localStorage.getItem('mkLtlModelV16')||localStorage.getItem('mkLtlModelV15');const x=JSON.parse(raw);if(x){state.admin=x.admin||state.admin;state.clients=Array.isArray(x.clients)&&x.clients.length?x.clients:state.clients;state.requests=Array.isArray(x.requests)?x.requests:[];state.notifications=Array.isArray(x.notifications)?x.notifications:[];state.notifyEmail=x.notifyEmail||state.notifyEmail;state.currency=x.currency||state.currency;state.lang=x.lang||state.lang;state.notifyBrowser=Boolean(x.notifyBrowser);state.requests.forEach(normalizeRequest)}}catch(e){}
  try{const urlLang=new URLSearchParams(location.search).get('lang');if(['pl','en','de'].includes(urlLang))state.lang=urlLang;}catch(e){}
  ensureDefaultClients();state.notifyEmail=state.notifyEmail||defaults.notifyEmail;
  const savedEmail=(()=>{try{return localStorage.getItem('mkFirebaseAuthEmail')||''}catch(e){return ''}})();
  if(savedEmail)setCurrentFromAuthEmail(savedEmail);
  if(authReady){await authReady;if(authUser){setCurrentFromAuthEmail(authUser.email||'');await loadCloudData();}}
}
function localToday(){const d=new Date();const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function postalOnly(v){
  const raw=String(v||'').trim().toUpperCase();
  if(!raw)return '';
  // Przykłady: „DE40472 Düsseldorf…”, „PL80-180 Gdańsk…”, „NL 1234 AB…”.
  const match=raw.match(/\b([A-Z]{2})[\s,;:-]*((?:\d{2}-\d{3})|(?:\d{4}\s?[A-Z]{2})|(?:\d{5})|(?:\d{3}\s?\d{2})|(?:\d{4})|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))\b/);
  if(match)return (match[1]+match[2]).replace(/\s+/g,'');
  const compact=raw.replace(/\s+/g,'');
  const fallback=compact.match(/^([A-Z]{2}[A-Z0-9-]{2,12})/);
  return fallback?fallback[1]:'';
}
function validPostalCode(v){const code=String(v||'').trim().toUpperCase();return /^[A-Z]{2}[A-Z0-9-]{2,12}$/.test(code)&&/\d/.test(code);}
function dateForStart(p){return p.dateStart||p.dateEnd||''}
function dateForEnd(p){return p.dateEnd||p.dateStart||''}
function normalizeRequest(r){
  r.loads=Array.isArray(r.loads)?r.loads:[];
  r.stops=Array.isArray(r.stops)?r.stops:[];
  r.unloads=Array.isArray(r.unloads)?r.unloads:[];
  [r.loads,r.stops,r.unloads].forEach(arr=>arr.forEach(p=>{p.postalCity=postalOnly(p.postalCity||p.address);p.address=String(p.address||'').trim();}));
  r.requirements=Array.isArray(r.requirements)?r.requirements:[];
  r.tempMin=r.tempMin||'';r.tempMax=r.tempMax||'';r.notes=r.notes||'';r.clientNote=r.clientNote||'';
  r.currency=r.currency||state.currency||'PLN';r.createdAt=r.createdAt||new Date().toISOString();r.submitted=Boolean(r.submitted);
  r.status=r.status||(r.submitted?'waiting':'draft');
  if(r.editing&&!r.submitted)r.status='draft';
  r.budgetProposalPending=Boolean(r.budgetProposalPending);
  r.clientProposal=r.clientProposal||'';r.clientProposalCurrency=r.clientProposalCurrency||r.currency;if(!r.clientEmail){const c=getClient(r.clientId);r.clientEmail=c?.email||'';}
  const lastUnloadDate=r.unloads.map(dateForEnd).filter(Boolean).sort().at(-1);
  if(lastUnloadDate&&lastUnloadDate<localToday()){
    if(r.status==='accepted')r.status='finalized';
    else if(!['draft','cancelled','archived','finalized'].includes(r.status))r.status='archived';
  }
}
function getClient(id){return state.clients.find(c=>c.id===id)}
function login(role){state.current=role==='admin'?state.admin:state.clients[0];state.view='loads';render()}
function normalizeLogin(v){return String(v||'').trim().toLocaleLowerCase('pl-PL')}
function accountMatches(account,login){const values=[account.login,account.email,account.id,account.companyCode,account.company].filter(Boolean).map(normalizeLogin);return values.includes(login)}
async function loginWithCode(){
  const loginRaw=String($('#loginEmail')?.value||'').trim();
  const code=String($('#loginCode')?.value||'').trim();
  if(!loginRaw||!code){toast('Wpisz login i kod dostępu.');return}
  try{
    if(cloudOnline&&fbAuth){
      const cred=await signInWithEmailAndPassword(fbAuth,loginAlias(loginRaw),code);
      const signedEmail=cred?.user?.email||loginAlias(loginRaw);
      try{localStorage.setItem('mkFirebaseAuthEmail',signedEmail);}catch(e){}
      setCurrentFromAuthEmail(signedEmail);
      await loadCloudData();
      setCurrentFromAuthEmail(signedEmail);
      document.querySelector('#loginModal')?.remove();
      render();toast('Zalogowano.');return;
    }
  }catch(err){console.warn('Firebase login error',err);toast('Nieprawidłowy login albo kod dostępu w Firebase.');return}
  const login=normalizeLogin(loginRaw);
  if(accountMatches(state.admin,login)&&code===state.admin.accessCode){state.current=state.admin;state.view='loads';try{localStorage.setItem('mkFirebaseAuthEmail',state.admin.email||state.admin.login||'')}catch(e){}render();return}
  const client=state.clients.find(c=>accountMatches(c,login)&&String(c.accessCode||'123')===code);
  if(client){state.current=client;state.view='loads';try{localStorage.setItem('mkFirebaseAuthEmail',client.email||client.login||'')}catch(e){}render();return}
  toast('Nieprawidłowy login albo kod dostępu.');
}
async function logout(){try{if(cloudOnline&&fbAuth)await signOut(fbAuth);}catch(e){}try{localStorage.removeItem('mkFirebaseAuthEmail')}catch(e){}authUser=null;state.current=null;render()}
function sidebarLoadPlanner(){return `<div class="sidebar-tool sidebar-loadplanner-placeholder sidebar-brand-loadplanner" title="Load Planner 3D"><span class="sidebar-tool-icon">▧</span><div><b>Load Planner 3D</b></div></div><div class="sidebar-tool sidebar-barometer" title="Barometr"><span class="sidebar-tool-icon">◉</span><div><b>Barometr</b></div></div>`}
function sidebarBrand(){return `<div class="sidebar-top-brand"><div class="sidebar-logo-box"><img class="sidebar-mini-logo" src="padmain-logo-cutout.png" alt="Padmain logo"></div><div class="sidebar-top-brand-copy"><strong>Padmain Freight Exchange</strong><small>M.KULCZYK</small></div></div><div class="lang-public-label sidebar-lang-top">Wersja językowa</div>${langButtons()}${sidebarLoadPlanner()}`}
function sidebarBottom(logged=true){return `<div class="sidebar-bottom-stack"><a class="sidebar-partner-link" href="https://motohouse-tsl.com" target="_blank" rel="noopener noreferrer" aria-label="MotoHouse"><strong>${esc(ui('currentlyAt'))}</strong><img class="sidebar-partner-logo" src="https://mkulczyk.pl/motohouse-logo-2.svg" alt="MotoHouse"></a>${logged?`<button data-action="logout" class="btn dark logout">${esc(ui('logout'))}</button>`:''}</div>`}
function layout(inner){
  const c=state.current;
  const title=state.view==='profile'?ui('profile'):(c.role==='client'?ui('myInquiries'):(state.view==='clients'?ui('clients'):state.view==='settings'?ui('settings'):ui('operational')));
  const unread=unreadNotifications();
  const nav=c.role==='admin'
    ?`<button data-nav="loads" class="${state.view==='loads'?'active':''}">${esc(ui('inquiries'))} ${unread?`<span class="notification-badge">${unread}</span>`:''}</button><button data-nav="clients" class="${state.view==='clients'?'active':''}">${esc(ui('clients'))}</button><button data-nav="settings" class="${state.view==='settings'?'active':''}">${esc(ui('settings'))} ${unread?`<span class="notification-badge">${unread}</span>`:''}</button>`
    :`<button data-nav="loads" class="${state.view==='loads'?'active':''}">${esc(ui('myInquiries'))}</button>`;
  const who=c.role==='admin'?'M.Kulczyk':(c.company||'Klient');
  return `<section class="shell"><aside class="side">${sidebarBrand()}<nav class="nav">${nav}</nav>${sidebarBottom(true)}</aside><section class="workspace"><img class="padmain-bg-logo" src="padmain-logo-cutout.png" alt="" aria-hidden="true"><header class="topbar"><div class="crumb">${esc(ui('courses'))}<b>${esc(title)}</b></div><div class="user"><button type="button" class="profile-link" data-profile><span class="profile-name"><b>${esc(who)}</b><span>${esc(ui('accountProfile'))}</span></span><span class="avatar">${esc((c.company||'M').slice(0,2).toUpperCase())}</span></button></div></header><main class="main">${inner}</main></section></section><div class="fixed-notice"><b>Ważne:</b> to formularz zapytania, nie wiążące zlecenie transportu. Wiążące zlecenie powstaje dopiero po potwierdzeniu e-mailowym. Jeżeli transport został znaleziony poza panelem, usuń pozycję z listy. <span>Standardowe zapytania FTL oraz pilne zlecenia należy nadal składać tradycyjną drogą komunikacji. Ten panel służy głównie do ładunków drobnicowych.</span></div>`
}
const publicCopy={
  pl:{title:'Padmain Freight Exchange — zapytania drobnicowe',claimOne:'zapytanie',claimFast:'szybka weryfikacja',claimCarriers:'u ponad 9500 przewoźników w całej Europie',statCarriers:'przewoźników',statEurope:'cała Europa',statForm:'prosty formularz',lead:'Padmain Freight Exchange to panel do wygodnego składania i prowadzenia zapytań drobnicowych. Dodaj trasę, ładunek i termin — spedytor sprawdzi możliwości i poprowadzi status w jednym miejscu.',usage:'Standardowe zapytania FTL oraz pilne zlecenia należy nadal składać tradycyjną drogą komunikacji. Ten panel służy głównie do ładunków drobnicowych.',cta:'Dodaj zapytanie',login:'Zaloguj się',free:'Platforma jest w pełni darmowa',ask:'Poproś o dostęp',how:'Jak to działa',s1:'Uzupełniasz zapytanie',s1c:'Podajesz kraj, kod pocztowy, daty, godziny i parametry ładunku.',s2:'Sprawdzamy możliwości',s2c:'Weryfikujemy dostępność przewoźników w Europie.',s3:'Dostajesz ofertę',s3c:'Oferta i status są widoczne w panelu oraz mailowo.',p1:'Szybki formularz',p1c:'Trasa, okna czasowe, LDM, waga i wymagania.',p2:'Statusy zapytań',p2c:'Oczekujące, cena, oferta, realizacja i archiwum.',p3:'Konto klienta',p3c:'Po zalogowaniu widzisz wyłącznie swoje zgłoszenia.'},
  en:{title:'Padmain Freight Exchange — groupage inquiries',claimOne:'inquiry',claimFast:'fast verification',claimCarriers:'with over 9500 carriers across Europe',statCarriers:'carriers',statEurope:'all Europe',statForm:'simple form',lead:'Padmain Freight Exchange is a panel for convenient handling of groupage inquiries. Add the route, cargo and timing — the forwarding team checks options and manages the status in one place.',usage:'Standard FTL inquiries and urgent transport orders should still be submitted via the usual communication channels. This panel is mainly intended for groupage cargo.',cta:'Add inquiry',login:'Log in',free:'The platform is fully free',ask:'Request access',how:'How it works',s1:'Submit an inquiry',s1c:'Enter country, postal code, dates, time windows and cargo details.',s2:'We verify options',s2c:'We check carrier availability across Europe.',s3:'You receive an offer',s3c:'The offer and status are visible in the panel and by e-mail.',p1:'Fast form',p1c:'Route, time windows, LDM, weight and requirements.',p2:'Inquiry statuses',p2c:'Pending, price, offer, execution and archive.',p3:'Client account',p3c:'After login you only see your own inquiries.'},
  de:{title:'Padmain Freight Exchange — Stückgut-Anfragen',claimOne:'Anfrage',claimFast:'schnelle Prüfung',claimCarriers:'bei über 9500 Frachtführern in ganz Europa',statCarriers:'Frachtführer',statEurope:'ganz Europa',statForm:'einfaches Formular',lead:'Padmain Freight Exchange ist ein Panel zur strukturierten Bearbeitung von Stückgut-Anfragen. Route, Ladung und Termin eingeben — die Disposition prüft Optionen und führt den Status an einem Ort.',usage:'Standardmäßige FTL-Anfragen sowie dringende Aufträge sollen weiterhin über die üblichen Kommunikationswege eingereicht werden. Dieses Panel ist hauptsächlich für Stückgutladungen vorgesehen.',cta:'Anfrage hinzufügen',login:'Einloggen',free:'Die Plattform ist vollständig kostenlos',ask:'Zugang anfordern',how:'So funktioniert es',s1:'Anfrage erfassen',s1c:'Land, Postleitzahl, Datum, Zeitfenster und Ladungsdaten eingeben.',s2:'Wir prüfen Optionen',s2c:'Wir prüfen Frachtführer und Verfügbarkeit in Europa.',s3:'Sie erhalten ein Angebot',s3c:'Angebot und Status sind im Panel und per E-Mail sichtbar.',p1:'Schnelles Formular',p1c:'Route, Zeitfenster, LDM, Gewicht und Anforderungen.',p2:'Anfragestatus',p2c:'Wartend, Preis, Angebot, Durchführung und Archiv.',p3:'Kundenkonto',p3c:'Nach dem Login sehen Sie nur Ihre eigenen Anfragen.'}
};
function tPublic(k){return (publicCopy[state.lang]||publicCopy.pl)[k]||publicCopy.pl[k]||k}
const uiCopy={
  pl:{platform:'Padmain Freight Exchange',inquiries:'Zapytania',myInquiries:'Moje zapytania',clients:'Klienci i konta',settings:'Ustawienia',profile:'Profil',operational:'Panel operacyjny',accountProfile:'Profil konta',courses:'Padmain Freight Exchange',inquiryPlatform:'Padmain Freight Exchange',logout:'Wyloguj',loadplannerSmall:'',currentlyAt:'Obecnie w:',search:'Wyszukiwanie',searchPlaceholder:'Numer, klient, adres, status…',sort:'Sortowanie:',date:'Data',regDate:'Data rejestru',no:'Nr',route:'Trasa',cargo:'Ładunek',details:'Wymagania / notatka',budget:'Budżet',price:'Cena',status:'Status',operations:'Operacje',client:'Klient',addInquiry:'Dodaj zapytanie',clientLead:'Zgłoś transport w jednym prostym formularzu',clientEmpty:'Nie masz jeszcze zapytań. Kliknij „Dodaj zapytanie”, aby rozpocząć.',adminLead:'Lista do prowadzenia ofert — kraj i kod pocztowy, terminy, ładunek oraz status.',waiting:'Oczekujące',priceConfirm:'Cena do potwierdzenia',offerPrep:'Oferta w przygotowaniu',inProgress:'W realizacji',notifications:'Powiadomienia',notificationCenter:'Centrum powiadomień',noNotifications:'Brak powiadomień.',markRead:'Oznacz jako przeczytane',clear:'Wyczyść',settingsTitle:'Powiadomienia i domyślna waluta',notifyEmail:'E-mail do powiadomień administratora',browserNotify:'Powiadomienia systemowe w przeglądarce, gdy przeglądarka pozwoli',saveSettings:'Zapisz ustawienia',enableBrowser:'Włącz powiadomienia przeglądarki',testEmail:'Próba powiadomienia e-mail',systemSender:'Nadawca systemu',defaultCurrency:'Domyślna waluta budżetu'},
  en:{platform:'Padmain Freight Exchange',inquiries:'Inquiries',myInquiries:'My inquiries',clients:'Clients and accounts',settings:'Settings',profile:'Profile',operational:'Operations panel',accountProfile:'Account profile',courses:'Padmain Freight Exchange',inquiryPlatform:'Padmain Freight Exchange',logout:'Log out',loadplannerSmall:'',currentlyAt:'Currently at:',search:'Search',searchPlaceholder:'Number, client, address, status…',sort:'Sorting:',date:'Date',regDate:'Registered',no:'No.',route:'Route',cargo:'Cargo',details:'Requirements / note',budget:'Budget',price:'Price',status:'Status',operations:'Actions',client:'Client',addInquiry:'Add inquiry',clientLead:'Submit transport in one simple form. The list shows the key operational information only.',clientEmpty:'You have no inquiries yet. Click “Add inquiry” to start.',adminLead:'List for managing offers — country and postal code, dates, cargo and status.',waiting:'Pending',priceConfirm:'Price to confirm',offerPrep:'Offer in preparation',inProgress:'In progress',notifications:'Notifications',notificationCenter:'Notification center',noNotifications:'No notifications.',markRead:'Mark as read',clear:'Clear',settingsTitle:'Notifications and default currency',notifyEmail:'Admin notification e-mail',browserNotify:'Browser system notifications when allowed by the browser',saveSettings:'Save settings',enableBrowser:'Enable browser notifications',testEmail:'Test e-mail notification',systemSender:'System sender',defaultCurrency:'Default budget currency'},
  de:{platform:'Padmain Freight Exchange',inquiries:'Anfragen',myInquiries:'Meine Anfragen',clients:'Kunden und Konten',settings:'Einstellungen',profile:'Profil',operational:'Operatives Panel',accountProfile:'Kontoprofil',courses:'Padmain Freight Exchange',inquiryPlatform:'Padmain Freight Exchange',logout:'Abmelden',loadplannerSmall:'',currentlyAt:'Derzeit bei:',search:'Suche',searchPlaceholder:'Nummer, Kunde, Adresse, Status…',sort:'Sortierung:',date:'Datum',regDate:'Registriert',no:'Nr.',route:'Route',cargo:'Ladung',details:'Anforderungen / Notiz',budget:'Budget',price:'Preis',status:'Status',operations:'Aktionen',client:'Kunde',addInquiry:'Anfrage hinzufügen',clientLead:'Transport in einem einfachen Formular melden. Die Liste zeigt nur die wichtigsten operativen Informationen.',clientEmpty:'Sie haben noch keine Anfragen. Klicken Sie auf „Anfrage hinzufügen“, um zu starten.',adminLead:'Liste zur Angebotsführung — Land und Postleitzahl, Termine, Ladung und Status.',waiting:'Wartend',priceConfirm:'Preis zu bestätigen',offerPrep:'Angebot in Vorbereitung',inProgress:'In Durchführung',notifications:'Benachrichtigungen',notificationCenter:'Benachrichtigungszentrum',noNotifications:'Keine Benachrichtigungen.',markRead:'Als gelesen markieren',clear:'Löschen',settingsTitle:'Benachrichtigungen und Standardwährung',notifyEmail:'Admin-Benachrichtigungs-E-Mail',browserNotify:'Systembenachrichtigungen im Browser, wenn erlaubt',saveSettings:'Einstellungen speichern',enableBrowser:'Browser-Benachrichtigungen aktivieren',testEmail:'Test-E-Mail-Benachrichtigung',systemSender:'Systemabsender',defaultCurrency:'Standardwährung für Budget'}
};
function ui(k){return (uiCopy[state.lang]||uiCopy.pl)[k]||uiCopy.pl[k]||k}
function publicLayout(inner){return `<section class="shell"><aside class="side">${sidebarBrand()}<div class="guest-nav-note"><b>${esc(tPublic('free'))}</b><br>Panel dostępny po nadaniu konta klienta.</div><nav class="nav"><button class="active">${esc(ui('platform'))}</button></nav>${sidebarBottom(false)}</aside><section class="workspace"><img class="padmain-bg-logo" src="padmain-logo-cutout.png" alt="" aria-hidden="true"><header class="topbar"><div class="crumb">${esc(ui('courses'))}<b>${esc(ui('inquiryPlatform'))}</b></div><div class="user"><button type="button" class="profile-link login-top" data-open-login><span class="profile-name"><b>${esc(tPublic('login'))}</b><span>Dostęp dla klientów</span></span><span class="avatar">↗</span></button></div></header><main class="main">${inner}</main></section></section>`}
function renderPublic(){return publicLayout(`<section class="public-hero"><div class="public-hero-main"><span class="public-eyebrow">${esc(tPublic('free'))}</span><div class="public-claim" aria-label="${esc(tPublic('title'))}"><div class="public-claim-top"><span class="public-claim-number">1</span><div class="public-claim-text"><strong>${esc(tPublic('claimOne'))}</strong><span>${esc(tPublic('claimFast'))}</span></div></div><div class="public-carrier-line"><span>${esc(tPublic('claimCarriers'))}</span></div></div><p>${esc(tPublic('lead'))}</p><div class="public-hero-actions"><button class="btn red" data-action="add-request">+ ${esc(tPublic('cta'))}</button><button class="btn" data-open-login>${esc(tPublic('login'))}</button></div><div class="public-stats"><div class="public-stat"><b>9500+</b><span>${esc(tPublic('statCarriers'))}</span></div><div class="public-stat"><b>EU</b><span>${esc(tPublic('statEurope'))}</span></div><div class="public-stat"><b>1</b><span>${esc(tPublic('statForm'))}</span></div></div></div><aside class="public-card"><h3>${esc(tPublic('how'))}</h3><div class="public-steps"><div class="public-step"><i>1</i><div><b>${esc(tPublic('s1'))}</b><span>${esc(tPublic('s1c'))}</span></div></div><div class="public-step"><i>2</i><div><b>${esc(tPublic('s2'))}</b><span>${esc(tPublic('s2c'))}</span></div></div><div class="public-step"><i>3</i><div><b>${esc(tPublic('s3'))}</b><span>${esc(tPublic('s3c'))}</span></div></div></div><div class="login-request-access"><b>${esc(tPublic('ask'))}</b><br>contact@mkulczyk.pl<small>Dostęp aktywuje administrator po utworzeniu konta.</small></div></aside></section>`)}
function loginModal(){document.querySelector('.modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="loginModal"><section class="modal-card login-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><div class="brand"><span class="brand-bar" aria-hidden="true"></span><div><strong>Padmain Freight Exchange</strong><small>M.KULCZYK · DOSTĘP</small></div></div><h2>Zaloguj się</h2><p>Wpisz login oraz kod dostępu otrzymany od administratora.</p><form class="login-form" id="accessLoginForm"><label>Login / e-mail<input id="loginEmail" autocomplete="username" placeholder="np. contact@mkulczyk.pl, test albo nord"></label><label>Kod dostępu<input id="loginCode" type="password" autocomplete="current-password" placeholder="Kod dostępu"></label><div class="login-actions"><button class="btn red" type="submit">Zaloguj</button><span class="login-help">Platforma darmowa dla klientów</span></div></form><div class="login-request-access"><b>Poproś o dostęp</b><br>Napisz na <b>contact@mkulczyk.pl</b>, jeżeli chcesz korzystać z platformy.<small>Dostęp nadaje administrator po utworzeniu konta klienta.</small></div><p class="secure-note">Logowanie działa przez Firebase. Konto musi istnieć w Authentication, a profil klienta w panelu admina.</p></section></div>`);setTimeout(()=>$('#loginEmail')?.focus(),0)}
function renderLogin(){return renderPublic()}
function dataCell(c,admin=false){return `<td class="data sep-r"><div class="data-lines"><b>${esc(c.company)}</b><span>${esc(c.contact)}</span><span>${esc(c.email)}</span><span>${esc(c.phone)}</span></div></td>`}
function formatDate(v){if(!v)return '';const a=String(v).split('-');return a.length===3?`${a[2]}.${a[1]}`:v}
function pointDates(p){const a=formatDate(p.dateStart),b=formatDate(p.dateEnd);return a?(b?`${a}–${b}`:a):(b||'')}
function pointTimes(p){const a=p.timeStart||'',b=p.timeEnd||'';return a?(b?`${a}–${b}`:a):(b||'')}
function locationSummary(p){return [p.postalCity||'',pointDates(p),pointTimes(p)].filter(Boolean).join(' | ')}
function onePointSummary(p){const base=locationSummary(p);return `${p.type?`${p.type}: `:''}${base}`}
function fullPointSummary(p){return onePointSummary(p)}
function routeSummary(arr){return (arr||[]).map(fullPointSummary).filter(Boolean).join('\n')}
function pointLineHtml(p){const location=p.postalCity||'',date=pointDates(p),time=pointTimes(p);const tail=[date,time].filter(Boolean).join(' | ');const body=`${location?`<b>${esc(location)}</b>`:''}${location&&tail?' | ':''}${esc(tail)}`;return body?`${p.type?`${esc(p.type)}: `:''}${body}`:''}
function routeLines(arr){return (arr||[]).map(p=>{const text=pointLineHtml(p);return text?`<div class="route-line" title="${esc(fullPointSummary(p))}">${text}</div>`:''}).join('')}
function routeCell(r,key,editable){const arr=r[key]||[];const cls='route-cell sep-r';const required=key!=='stops';if(editable){const showMissing=required&&!r.submitted;const emptyClass=arr.length||!showMissing?'':'missing-strong';return `<td class="${cls}"><div class="route-actions"><div class="route-lines">${routeLines(arr)}</div><button class="btn small ${emptyClass}" data-route-id="${esc(r.id)}" data-route-kind="${key}">${arr.length?'+':'+ dodaj'}</button></div></td>`}return `<td class="${cls}"><div class="route-lines">${routeLines(arr)}</div></td>`}
function requirementsText(r){const out=(r.requirements||[]).filter(k=>k!=='temperature').map(k=>reqLabels[k]).filter(Boolean);if((r.requirements||[]).includes('temperature'))out.push(`Temperatura ${r.tempMin||''}${r.tempMin&&r.tempMax?'–':''}${r.tempMax||''}°C`);return out.join(' | ')}
function requirementsCell(r,editable){const txt=requirementsText(r);const content=txt?esc(txt):'<span class="requirement-empty">Brak</span>';if(editable)return `<td class="requirement"><span class="route-summary" title="${esc(txt)}">${content}</span><button class="btn small" data-requirements="${esc(r.id)}">Wymagania (opcjonalnie)</button></td>`;return `<td class="requirement" title="${esc(txt)}"><span class="route-summary">${content}</span></td>`}
function clientNoteCell(r,editable){if(editable)return `<td class="cell client-note-cell"><textarea name="clientNote" maxlength="500" aria-label="Notatka dla spedytora" placeholder="Opcjonalnie">${esc(r.clientNote||'')}</textarea></td>`;const note=esc(r.clientNote||'—');return `<td class="client-note-cell"><span class="client-note-preview" title="${esc(r.clientNote||'')}">${note}</span></td>`}
function valueCell(v,cls='cell'){return `<td class="${cls}">${esc(v||'')}</td>`}
function formatPostal(v){
  const code=postalOnly(v);if(!code)return '—';
  const m=code.match(/^([A-Z]{2})(.*)$/);return m?`${m[1]} ${m[2]}`:code;
}
function routePoints(r){
  const out=[];
  const add=(key,label)=>{(r[key]||[]).forEach((p,i)=>out.push({key,label:(r[key]||[]).length>1?`${label} ${i+1}`:label,p}));};
  add('loads','Załadunek');add('stops','Punkt pośredni');add('unloads','Rozładunek');
  return out;
}
function pointWhen(p){const date=pointDates(p),time=pointTimes(p);return [date,time].filter(Boolean).join(' · ')||'termin do ustalenia'}
function routeFlowHtml(r){
  const points=routePoints(r);
  if(!points.length)return '<span class="empty-route">Trasa do uzupełnienia</span>';
  const flow=points.map((x,i)=>`${i?'<span class="route-arrow">→</span>':''}<div class="route-stop"><b>${esc(formatPostal(x.p.postalCity||x.p.address))}</b><small>${esc(pointWhen(x.p))}</small></div>`).join('');
  return `<div class="route-flow">${flow}</div>`;
}
function cargoSummaryHtml(r){
  const values=[['LDM',r.ldm?ldmDisplay(r.ldm):'—'],['Waga',r.weight?`${r.weight} t`:'—'],['Strona',r.access||'—']];
  return `<div class="cargo-summary">${values.map(([k,v])=>`<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>${r.notes?`<p class="cargo-note">${esc(r.notes)}</p>`:''}`;
}
function detailSummaryHtml(r){
  const requirements=requirementsText(r);
  const note=String(r.clientNote||'').trim();
  return `<div class="detail-summary">${requirements?`<p><b>Wymagania:</b> ${esc(requirements)}</p>`:''}${note?`<p><b>Notatka:</b> ${esc(note)}</p>`:''}${!requirements&&!note?'<span class="muted-dash">—</span>':''}</div>`;
}
function clientStatusTooltip(r){
  const c=getClient(r.clientId)||{};
  const mail=c.email||r.clientEmail||'adres e-mail klienta';
  const tips={
    waiting:'Spedytor wkrótce rozpatrzy zgłoszenie.',
    searching:'Jeżeli tylko pojawią się oferty, spedytor bezzwłocznie powiadomi Cię.',
    offer:`Spedytor wysłał ofertę, sprawdź skrzynkę pocztową: ${mail}.`,
    accepted:'Transport jest w realizacji.',
    finalized:'Transport został zrealizowany.',
    archived:'Zapytanie jest w archiwum.',
    budget:'Spedytor wysłał propozycję ceny do potwierdzenia.',
    budgetAccepted:'Cena potwierdzona — spedytor przygotuje ofertę.',
    counter:'Trwa negocjacja ceny.',
    cancelled:'Zapytanie zostało odrzucone.'
  };
  return tips[r.status]||statusLabel(r.status);
}
function statusTag(r,admin=false){
  const label=statusLabel(r.status);
  return admin
    ?`<button type="button" class="status-tag ${esc(r.status)} status-trigger" data-open-status="${esc(r.id)}" aria-label="Zmień status: ${esc(label)}">${esc(label)}</button>`
    :`<span class="status-tag ${esc(r.status)}" title="${esc(clientStatusTooltip(r))}">${esc(label)}</span>`;
}
function clientFaqHtml(){
  return `<section class="card client-faq"><h2>FAQ</h2><h3>Jak to działa?</h3><ol><li>Zgłoś ładunek zgodnie z prawdziwymi danymi i podaj budżet.</li><li>Spedytor rozpatrzy zapytanie i ewentualnie podpowie, ile może kosztować transport. To nie jest jeszcze umowa transportu.</li><li>Po zatwierdzeniu stawki dla obu stron oferta zostaje przesłana do bazy ponad 9500 przewoźników z całej Europy.</li><li>Powiadomienie o znalezieniu auta dostaniesz na pocztę. Jeżeli nie odpowiesz w ciągu 20–30 minut, spedytor spróbuje skontaktować się z Tobą telefonicznie.</li><li>Pamiętaj o anulowaniu zgłoszenia, jeżeli nie potrzebujesz już transportu — to ułatwi moją pracę.</li></ol></section>`;
}
function renderClient(){
  const c=state.current;const mine=state.requests.filter(r=>r.clientId===c.id);const ordered=sortedRequests(mine,'client');
  const rows=ordered.length?ordered.map(clientRow).join(''):`<tr><td colspan="8"><div class="empty">${esc(ui('clientEmpty'))}</div></td></tr>`;
  return layout(`<div class="head"><div><h1>${esc(ui('myInquiries'))}</h1><p>${esc(ui('clientLead'))}</p></div><button class="btn red add-load" data-action="add-request">+ ${esc(ui('addInquiry'))}</button></div><section class="card table-card modern-table">${tableToolbar('client')}<div class="table-wrap"><table class="tbl compact-list"><colgroup><col class="col-reg"><col class="col-code"><col class="col-route"><col class="col-cargo"><col class="col-details"><col class="col-money"><col class="col-status"><col class="col-actions"></colgroup><thead><tr><th>${sortHead(ui('regDate'),'createdAt','client')}</th><th>${sortHead(ui('no'),'code','client')}</th><th>${sortHead(ui('route'),'route','client')}</th><th>${sortHead(ui('cargo'),'cargo','client')}</th><th>${sortHead(ui('details'),'details','client')}</th><th>${sortHead(ui('budget'),'budget','client')}</th><th>${sortHead(ui('status'),'status','client')}</th><th>${esc(ui('operations'))}</th></tr></thead><tbody>${rows}</tbody></table></div></section>${clientFaqHtml()}`);
}
function clientRow(r){
  normalizeRequest(r);
  const c=getClient(r.clientId)||{};
  const pending=Boolean(r.budgetProposalPending)||r.status==='budget';
  const remove=`<button class="btn danger small" data-delete="${esc(r.id)}">Usuń</button>`;
  let actions='';
  if(r.status==='archived') actions=`<span class="counter-note">Pozycja w archiwum</span>`;
  else if(pending) actions=`<span class="counter-note">Czekamy na Twoją decyzję</span>${remove}`;
  else if(r.status==='counter') actions=`<span class="counter-note">Negocjacje cenowe</span>${remove}`;
  else if(r.status==='budgetAccepted') actions=`<span class="counter-note">Cena potwierdzona — czekamy na spedytora</span>${remove}`;
  else if(r.status==='searching') actions=`<span class="counter-note">Oferta jest przygotowywana</span>${remove}`;
  else if(r.status==='offer') actions=`${remove}`;
  else if(r.status==='accepted') actions=`<span class="counter-note">Transport w realizacji</span>${remove}`;
  else if(r.status==='finalized') actions=`<span class="counter-note">Zrealizowano</span>${remove}`;
  else actions=`<button class="btn small" data-edit="${esc(r.id)}">Edytuj</button>${remove}`;
  const budget=r.budget?`${r.budget} ${r.currency||state.currency}`:'—';
  const main=`<tr class="request-row row-${esc(r.status)}" data-table-role="client" data-request-id="${esc(r.id)}" data-search="${esc(requestSearchText(r,c))}">${registeredCell(r)}<td class="code">${esc(r.code)}</td><td class="route-main">${routeFlowHtml(r)}</td><td class="cargo-cell">${cargoSummaryHtml(r)}</td><td class="details-cell">${detailSummaryHtml(r)}</td><td class="money-cell ${pending?'budget-pending':''}"><b>${esc(budget)}</b></td><td class="status-cell">${statusTag(r)}</td><td class="action-cell"><div class="actions">${actions}</div></td></tr>`;
  if(!pending)return main;
  return main+`<tr class="budget-proposal-row" data-proposal-for="${esc(r.id)}"><td colspan="8"><div class="budget-proposal"><span class="budget-proposal-copy"><strong>Zaproponowano cenę:</strong> ${esc(r.budget||'')} ${esc(r.currency||state.currency)}. Wybierz decyzję.</span><div class="proposal-actions"><button class="btn danger small" data-decline-budget="${esc(r.id)}">Odmów</button><button class="btn small" data-counter-budget="${esc(r.id)}">Proponuję inną</button><button class="btn red small" data-accept-budget="${esc(r.id)}">Potwierdzam cenę</button></div></div></td></tr>`;
}
function renderAdmin(){
  const counts={waiting:0,budget:0,searching:0,accepted:0};
  state.requests.forEach(r=>{if(counts[r.status]!==undefined)counts[r.status]++});
  const ordered=sortedRequests(state.requests,'admin');
  const rows=ordered.length?ordered.map(adminRow).join(''):`<tr><td colspan="9"><div class="empty">Brak zapytań od klientów.</div></td></tr>`;
  return layout(`<div class="head"><div><h1>${esc(ui('operational'))}</h1><p>${esc(ui('adminLead'))}</p></div></div><div class="metrics"><div class="metric"><span>${esc(ui('waiting'))}</span><b>${counts.waiting}</b></div><div class="metric"><span>${esc(ui('priceConfirm'))}</span><b>${counts.budget}</b></div><div class="metric"><span>${esc(ui('offerPrep'))}</span><b>${counts.searching}</b></div><div class="metric"><span>${esc(ui('inProgress'))}</span><b>${counts.accepted}</b></div></div><section class="card table-card modern-table">${tableToolbar('admin')}<div class="table-wrap"><table class="tbl compact-list admin-list"><colgroup><col class="col-reg"><col class="col-code"><col class="col-client"><col class="col-route"><col class="col-cargo"><col class="col-details"><col class="col-money"><col class="col-status"><col class="col-actions"></colgroup><thead><tr><th>${sortHead(ui('regDate'),'createdAt','admin')}</th><th>${sortHead(ui('no'),'code','admin')}</th><th>${sortHead(ui('client'),'client','admin')}</th><th>${sortHead(ui('route'),'route','admin')}</th><th>${sortHead(ui('cargo'),'cargo','admin')}</th><th>${sortHead(ui('details'),'details','admin')}</th><th>${sortHead(ui('price'),'budget','admin')}</th><th>${sortHead(ui('status'),'status','admin')}</th><th>${esc(ui('operations'))}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`);
}
function offerEmailButton(id){
  return `<button type="button" class="email-action-tile" data-open-offer-mail-langs="${esc(id)}"><span class="mail-logo">✉</span><span>Email</span></button>`
}
function openOfferMailLangModal(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  document.querySelector('.modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="offerMailLangModal"><section class="modal-card mail-lang-modal"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Wybierz język e-maila</h2><p>Wiadomość zostanie przygotowana z danymi zgłoszenia ${esc(r.code||'')}.</p><div class="mail-lang-choices">${Object.values(langs).map(l=>`<button type="button" class="mail-lang-choice" data-send-offer-mail="${esc(id)}" data-mail-lang="${l.code}"><img src="${l.flag}" alt="${l.label}"><span>${l.label}</span></button>`).join('')}</div></section></div>`);
}
function adminRow(r){
  normalizeRequest(r);
  const c=getClient(r.clientId)||{};
  const hasBudget=Boolean(String(r.budget||'').trim());
  let decision='';
  if(r.status==='archived'){
    decision=`<span class="counter-note">Archiwum${r.archiveReason?`: ${esc(r.archiveReason)}`:''}</span><button class="btn danger small" data-delete="${esc(r.id)}">Usuń trwale</button>`;
  } else if(r.status==='waiting'){
    decision=`<button class="btn red small" data-propose-budget="${esc(r.id)}">Zaproponuj cenę</button>${hasBudget?`<button class="btn small" data-confirm-budget="${esc(r.id)}">Potwierdź budżet</button>`:''}`;
  } else if(r.status==='budgetAccepted'){
    decision=`<button class="btn red small" data-confirm-budget="${esc(r.id)}">Potwierdź budżet</button>`;
  } else if(r.status==='counter'){
    decision=`<span class="counter-note">Propozycja klienta — decyzja na pasku pod pozycją</span>`;
  } else if(r.status==='searching'){
    decision=`<button class="btn red small" data-offer-sent="${esc(r.id)}">Zaoferowano</button>${offerEmailButton(r.id)}`;
  } else if(r.status==='offer'){
    decision=`<button class="btn red small" data-start-realisation="${esc(r.id)}">W realizacji</button>${offerEmailButton(r.id)}`;
  } else if(r.status==='accepted'){
    decision=`<span class="counter-note">Transport w realizacji</span>`;
  } else if(r.status==='budget'){
    decision=`<span class="counter-note">Czekamy na potwierdzenie ceny przez klienta</span>`;
  }
  if(!decision) decision=`<span class="counter-note">—</span>`;
  const adminDelete=r.status!=='archived'?`<button class="btn danger small" data-delete="${esc(r.id)}">Usuń</button>`:'';
  const client=`<div class="client-card"><b>${esc(c.company||'—')}</b><span>${esc(c.contact||'')}</span><span>${esc(c.phone||'')}</span></div>`;
  const price=r.budget?`<b>${esc(r.budget)} ${esc(r.currency||state.currency)}</b>`:'<span class="muted-dash">—</span>';
  const clientArchived=r.status==='archived'&&r.archivedBy==='client'&&!r.archiveNoticeConfirmed;
  const archiveConfirmed=r.status==='archived'&&r.archiveNoticeConfirmed;
  const rowCls=`request-row row-${esc(r.status)} ${clientArchived?'row-clientArchived':''} ${archiveConfirmed?'row-archiveConfirmed':''}`;
  const main=`<tr class="${rowCls}" data-table-role="admin" data-request-id="${esc(r.id)}" data-admin-row="${esc(r.id)}" data-search="${esc(requestSearchText(r,c))}">${registeredCell(r)}<td class="code">${esc(r.code)}</td><td class="client-cell">${client}</td><td class="route-main">${routeFlowHtml(r)}</td><td class="cargo-cell">${cargoSummaryHtml(r)}</td><td class="details-cell">${detailSummaryHtml(r)}</td><td class="money-cell">${price}</td><td class="status-cell">${statusTag(r,true)}</td><td class="action-cell"><div class="admin-actions">${decision}${adminDelete}<button class="btn small" data-copy="${esc(r.id)}">Kopiuj</button></div></td></tr>`;
  let extra='';
  if(clientArchived)extra+=`<tr class="archive-warning-row" data-proposal-for="${esc(r.id)}"><td colspan="9"><div class="archive-warning"><span><b>Klient przeniósł zapytanie do archiwum.</b> Powód: ${esc(r.archiveReason||'nie podano')}. Poprzedni status: ${esc(statusLabel(r.archivedFrom||''))}.</span><button class="btn red small" data-confirm-archive-notice="${esc(r.id)}">Potwierdź</button></div></td></tr>`;
  if(r.status==='counter')extra+=`<tr class="admin-counter-row" data-proposal-for="${esc(r.id)}"><td colspan="9"><div class="admin-counter-bar"><span><strong>Klient zaproponował własną cenę:</strong> ${esc(r.clientProposal||'')} ${esc(r.clientProposalCurrency||r.currency||state.currency)} dla zapytania ${esc(r.code||'')}.</span><div class="proposal-actions"><button class="btn red small" data-approve-counter="${esc(r.id)}">Potwierdź</button><button class="btn danger small" data-decline-counter="${esc(r.id)}">Odmów</button><button class="btn small" data-propose-budget="${esc(r.id)}">Zaproponuj swoją</button></div></div></td></tr>`;
  return main+extra;
}
function sortedClients(){
  const ui=tableUi.accounts,collator=new Intl.Collator('pl',{numeric:true,sensitivity:'base'});
  const val=c=>({company:c.company||'',code:c.companyCode||'',vat:c.vatEu||'',contact:c.contact||c.name||'',email:c.email||'',language:c.language||'',login:c.login||'',accessCode:c.accessCode||''}[ui.key]||'');
  return [...state.clients].sort((a,b)=>collator.compare(String(val(a)),String(val(b)))*(ui.dir==='asc'?1:-1));
}
function accountSortHead(label,key){const ui=tableUi.accounts;return `<button type="button" data-account-sort-key="${key}">${esc(label)} ${ui.key===key?(ui.dir==='asc'?'↑':'↓'):''}</button>`}
function renderClients(){
  const q=String(tableUi.accounts.query||'').trim().toLocaleLowerCase('pl-PL');
  const rows=sortedClients().filter(c=>!q||[c.company,c.companyCode,c.vatEu,c.contact,c.name,c.email,c.login,c.language].join(' ').toLocaleLowerCase('pl-PL').includes(q)).map(c=>`<tr><td><b>${esc(c.company)}</b><br><span class="info">${esc(c.companyCode)}</span></td><td>${esc(c.vatEu||'—')}</td><td>${esc(c.contact||c.name||'—')}<br><span class="info">${esc(c.phone||'')}</span></td><td>${esc(c.email||'—')}<br><span class="info">login: ${esc(c.login||'—')}</span></td><td><span class="account-lang">${esc(String(c.language||'pl').toUpperCase())}</span></td><td>${esc(c.accessCode||'—')}</td><td><div class="account-actions-inline"><button class="btn small" data-edit-client="${esc(c.id)}">Edytuj</button><button class="btn danger small" data-delete-client="${esc(c.id)}">Usuń</button></div></td></tr>`).join('');
  return layout(`<div class="head"><div><h1>Klienci i konta</h1><p>Admin może dodawać, edytować i usuwać profile klientów, VAT EU, język oraz kod dostępu profilu.</p></div><div class="account-actions"><button class="btn red" data-add-client>+ Dodaj konto</button></div></div><section class="card"><div class="account-tools"><label class="table-search"><span>Wyszukiwanie kont</span><input type="search" data-account-search value="${esc(tableUi.accounts.query)}" placeholder="Firma, VAT, login, e-mail…"></label><span class="info">Sortowanie działa po kliknięciu nagłówka.</span></div><table class="account-table"><thead><tr><th>${accountSortHead('Firma / kod','company')}</th><th>${accountSortHead('VAT EU','vat')}</th><th>${accountSortHead('Osoba','contact')}</th><th>${accountSortHead('E-mail / login','email')}</th><th>${accountSortHead('Język','language')}</th><th>${accountSortHead('Kod dostępu','accessCode')}</th><th>Operacje</th></tr></thead><tbody>${rows||`<tr><td colspan="7"><div class="empty">Brak kont dla tego wyszukiwania.</div></td></tr>`}</tbody></table></section>`);
}
function openClientAddModal(){
  if(state.current?.role!=='admin'){loginModal();return}
  const id='client'+Date.now();
  const c={id,role:'client',company:'Nowy klient',companyCode:'KL',vatEu:'',language:'pl',name:'',contact:'',email:'',phone:'',login:'',accessCode:'123'};
  state.clients.push(c);store();openClientEditModal(id);
}
function openClientEditModal(id){
  if(state.current?.role!=='admin'){loginModal();return}
  const c=state.clients.find(x=>x.id===id);if(!c)return;
  document.querySelector('.modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="clientEditModal"><section class="modal-card edit-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Edytuj konto klienta</h2><p>Profil zapisuje się w Firestore. Konto logowania z tym samym e-mailem dodaj w Firebase Authentication.</p><div class="edit-form"><label>Firma<input id="clientCompany" value="${esc(c.company||'')}"></label><label>Kod klienta<input id="clientCode" maxlength="8" value="${esc(c.companyCode||'')}"></label><label>VAT EU<input id="clientVat" value="${esc(c.vatEu||'')}"></label><label>Język<select id="clientLanguage">${['pl','en','de'].map(x=>`<option value="${x}" ${String(c.language||'pl')===x?'selected':''}>${x.toUpperCase()}</option>`).join('')}</select></label><label>Osoba kontaktowa<input id="clientContact" value="${esc(c.contact||c.name||'')}"></label><label>Telefon<input id="clientPhone" value="${esc(c.phone||'')}"></label><label>E-mail<input id="clientEmail" type="email" value="${esc(c.email||'')}"></label><label>Login<input id="clientLogin" value="${esc(c.login||'')}"></label><label class="full">Kod dostępu / hasło Firebase<input id="clientAccessCode" value="${esc(c.accessCode||'')}" placeholder="Hasło ustawiasz też w Firebase Authentication"></label></div><div class="modal-actions"><button class="btn" data-close-modal>Anuluj</button><button class="btn red" data-save-client="${esc(id)}">Zapisz konto</button></div></section></div>`);
}
function saveClientAccount(id){
  if(state.current?.role!=='admin'){loginModal();return}
  const c=state.clients.find(x=>x.id===id);if(!c)return;
  c.company=$('#clientCompany')?.value.trim()||c.company;c.companyCode=($('#clientCode')?.value.trim()||c.companyCode).toUpperCase();c.vatEu=$('#clientVat')?.value.trim()||'';c.language=$('#clientLanguage')?.value||'pl';c.contact=$('#clientContact')?.value.trim()||'';c.name=c.contact;c.phone=$('#clientPhone')?.value.trim()||'';c.email=$('#clientEmail')?.value.trim()||'';c.login=$('#clientLogin')?.value.trim()||c.email||c.companyCode||c.id;c.accessCode=$('#clientAccessCode')?.value.trim()||'123';
  store();document.querySelector('#clientEditModal')?.remove();render();toast('Konto klienta zapisane.');
}
function openDeleteClientModal(id){
  if(state.current?.role!=='admin'){loginModal();return}
  const c=state.clients.find(x=>x.id===id);if(!c)return;
  const linked=state.requests.filter(r=>r.clientId===id).length;
  document.querySelector('.modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="deleteClientModal"><section class="modal-card delete-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Usunąć konto klienta?</h2><p>Usuniesz profil klienta <b>${esc(c.company||c.email||id)}</b> z listy „Klienci i konta”.</p><p class="account-delete-note">To usuwa profil zapisany w Firestore. Jeżeli konto logowania ma zniknąć całkowicie, usuń również tego użytkownika w Firebase → Authentication → Users.</p>${linked?`<p class="account-delete-note">Uwaga: klient ma ${linked} zapytań w systemie. Zapytania pozostają w bazie i archiwum.</p>`:''}<div class="modal-actions"><button class="btn" data-close-modal>Anuluj</button><button class="btn danger" data-confirm-delete-client="${esc(id)}">Usuń profil</button></div></section></div>`);
}
function confirmDeleteClient(id){
  if(state.current?.role!=='admin'){loginModal();return}
  const c=state.clients.find(x=>x.id===id);if(!c)return;
  cloudDeleted.clients.add(id);
  state.clients=state.clients.filter(x=>x.id!==id);
  store();document.querySelector('#deleteClientModal')?.remove();render();toast('Profil klienta usunięty. Użytkownika Auth usuń w Firebase, jeśli ma stracić login.');
}
function renderProfile(){
  const c=state.current||{};
  const role=c.role==='admin'?'Administrator / M.Kulczyk':'Klient';
  const rows=[['Profil',role],['Firma',c.company||'—'],['Osoba',c.name||c.contact||'—'],['E-mail',c.email||'—'],['Telefon',c.phone||'—'],['Kod klienta',c.companyCode||'—'],['Kod dostępu',c.accessCode||'123']];
  const addUser=c.role==='client'?`<div class="profile-tile profile-add-user"><div><span>Użytkownicy</span><b>Dodaj użytkownika</b></div><button class="btn red" data-add-user-info>Dodaj użytkownika</button></div>`:'';
  const editBtn=c.role==='admin'?`<button class="btn red" data-edit-profile>Edytuj</button>`:'';
  return layout(`<div class="head"><div><h1>Profil</h1><p>Dane konta używane w panelu i w szablonach wiadomości.</p></div><div class="profile-head-actions"><button class="btn" data-nav="loads">Wróć do listy</button>${editBtn}</div></div><section class="card profile-card"><div class="profile-grid">${rows.map(([k,v])=>`<div class="profile-tile"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}${addUser}</div></section>`)
}
function openProfileEditModal(){
  const c=state.admin;
  document.querySelector('.modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="profileEditModal"><section class="modal-card edit-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Edytuj profil admina</h2><p>Kod dostępu jest nazwany kodem, nie hasłem. Domyślnie ustawiony jest 123, później możesz go zmienić.</p><div class="edit-form"><label>Firma<input id="adminCompany" value="${esc(c.company||'')}"></label><label>Kod klienta<input id="adminCompanyCode" value="${esc(c.companyCode||'MK')}"></label><label>Osoba<input id="adminName" value="${esc(c.name||c.contact||'')}"></label><label>Telefon<input id="adminPhone" value="${esc(c.phone||'')}"></label><label>E-mail / login<input id="adminEmail" type="email" value="${esc(c.email||'contact@mkulczyk.pl')}"></label><label>Kod dostępu<input id="adminAccessCode" value="${esc(c.accessCode||'123')}"></label></div><div class="modal-actions"><button class="btn" data-close-modal>Anuluj</button><button class="btn red" data-save-profile>Zapisz profil</button></div></section></div>`);
}
function saveProfile(){
  const a=state.admin;a.company=$('#adminCompany')?.value.trim()||a.company;a.companyCode=($('#adminCompanyCode')?.value.trim()||'MK').toUpperCase();a.name=$('#adminName')?.value.trim()||a.name;a.contact=a.name;a.phone=$('#adminPhone')?.value.trim()||'';a.email=$('#adminEmail')?.value.trim()||'contact@mkulczyk.pl';a.login=a.email;a.accessCode=$('#adminAccessCode')?.value.trim()||'123';
  if(state.current?.role==='admin')state.current=state.admin;
  store();document.querySelector('#profileEditModal')?.remove();render();toast('Profil admina zapisany.');
}
function openAddUserInfo(){
  document.querySelector('.modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="addUserInfoModal"><section class="modal-card delete-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Dodanie użytkownika</h2><p>Dodawanie kolejnych użytkowników do konta jest wykonywane przez administratora.</p><p>Skontaktuj się z: <b>contact@mkulczyk.pl</b></p><div class="modal-actions"><button class="btn red" data-close-modal>OK</button></div></section></div>`);
}
function renderSettings(){
  const currencies=['PLN','EUR','GBP'];
  const unread=unreadNotifications();
  const notes=state.notifications.length?state.notifications.map(n=>`<div class="notification-item ${n.read?'read':''}"><div><b>${esc(n.kind)} ${n.code?`· ${esc(n.code)}`:''}</b><span>${esc(formatRegisteredAt(n.createdAt))} · ${esc(n.client||'')} ${n.details?`· ${esc(n.details)}`:''}</span></div></div>`).join(''):`<div class="notification-empty">${esc(ui('noNotifications'))}</div>`;
  return layout(`<div class="head"><div><h1>${esc(ui('settings'))}</h1><p>Adres alertów administratora: ${esc(state.notifyEmail||defaults.notifyEmail)}.</p></div></div><section class="card"><h2 class="section-title">${esc(ui('settingsTitle'))}</h2><form id="settingsForm" class="form-grid"><div class="field full"><label>${esc(ui('systemSender'))}</label><input value="powiadomienia@mkulczyk.pl" readonly></div><div class="field"><label>${esc(ui('notifyEmail'))}</label><input id="notifyEmail" type="email" value="${esc(state.notifyEmail)}"></div><div class="field"><label>${esc(ui('defaultCurrency'))}</label><select id="defaultCurrency">${currencies.map(x=>`<option ${state.currency===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label class="settings-switch"><input id="notifyBrowser" type="checkbox" ${state.notifyBrowser?'checked':''}> ${esc(ui('browserNotify'))}</label></div><div class="field full"><div class="actions"><button class="btn red" type="submit">${esc(ui('saveSettings'))}</button><button class="btn" type="button" data-enable-browser-notify>${esc(ui('enableBrowser'))}</button><button class="btn" type="button" data-test-mail>${esc(ui('testEmail'))}</button></div></div></form><p class="settings-note"><b>Firebase:</b> zapytania, statusy, archiwum, klienci i powiadomienia zapisują się w Firestore. Prawdziwy e-mail automatyczny wymaga później Cloud Functions albo rozszerzenia Trigger Email.</p></section><section class="card" style="margin-top:12px"><h2 class="section-title">${esc(ui('notificationCenter'))} ${unread?`<span class="notification-badge">${unread}</span>`:''}</h2><div class="notification-list">${notes}</div><div class="modal-actions" style="padding:0 14px 14px"><button class="btn" data-mark-notifications-read>${esc(ui('markRead'))}</button><button class="btn danger" data-clear-notifications>${esc(ui('clear'))}</button></div></section>`);
}
function render(){state.requests.forEach(normalizeRequest);syncLoggedInSession();const app=$('#app');if(!state.current){app.innerHTML=renderPublic();return}if(state.view==='profile'){app.innerHTML=renderProfile();return}app.innerHTML=state.current.role==='client'?renderClient():state.view==='clients'?renderClients():state.view==='settings'?renderSettings():renderAdmin()}
function nextCode(c){const nums=state.requests.filter(r=>r.clientId===c.id).map(r=>parseInt((r.code||'').split('-')[1],10)||0);return `${c.companyCode}-${String(Math.max(0,...nums)+1).padStart(3,'0')}`}
function addRequest(){syncLoggedInSession();if(!state.current||state.current.role!=='client'){loginModal();return}const c=state.current;const r={id:'r'+Date.now(),createdAt:new Date().toISOString(),clientId:c.id,code:nextCode(c),editing:false,isNewDraft:true,status:'draft',submitted:false,loads:[],stops:[],unloads:[],ldm:'',notes:'',clientNote:'',weight:'',access:'',requirements:[],tempMin:'',tempMax:'',budget:'',currency:state.currency,budgetProposalPending:false,clientProposal:'',clientProposalCurrency:state.currency,clientEmail:c.email||''};state.requests.unshift(r);store();render();openRequestWizard(r.id)}
function draftFromRow(id){const row=document.querySelector(`[data-edit-row="${id}"]`);const r=state.requests.find(x=>x.id===id);if(!row||!r)return;r.ldm=row.querySelector('[name="ldm"]')?.value||'';r.notes=row.querySelector('[name="notes"]')?.value||'';r.clientNote=row.querySelector('[name="clientNote"]')?.value||'';r.weight=row.querySelector('[name="weight"]')?.value||'';r.access=row.querySelector('[name="access"]')?.value||'';r.budget=row.querySelector('[name="budget"]')?.value.trim()||'';r.currency=row.querySelector('[name="currency"]')?.value||state.currency;store()}
function pointStartKey(p){const d=dateForStart(p);return d?`${d}T${p.timeStart||'00:00'}`:''}
function pointEndKey(p){const d=dateForEnd(p);return d?`${d}T${p.timeEnd||'23:59'}`:''}
function validatePointDateRange(p,kind){
  const startDate=dateForStart(p),endDate=dateForEnd(p);
  if(startDate&&endDate&&startDate>endDate)return 'Data „do” nie może być wcześniejsza niż data „od”.';
  if(startDate&&endDate&&startDate===endDate&&p.timeStart&&p.timeEnd&&p.timeStart>p.timeEnd)return 'Godzina „do” nie może być wcześniejsza niż godzina „od”.';
  return '';
}
function validatePointNotPast(p){
  const today=localToday();
  const start=dateForStart(p),end=dateForEnd(p);
  if(start&&start<today)return `Data „od” nie może być wcześniejsza niż ${today.split('-').reverse().join('.')}.`;
  if(end&&end<today)return `Data „do” nie może być wcześniejsza niż ${today.split('-').reverse().join('.')}.`;
  return '';
}
function validateRouteDates(r){
  // Okna terminów mogą się nakładać lub stykać. Blokujemy tylko wtedy,
  // gdy rozładunek kończy się całkowicie przed rozpoczęciem załadunku.
  for(const kind of ['loads','stops','unloads']){
    for(const p of (r[kind]||[])){
      const err=validatePointDateRange(p,kind);
      if(err)return `${routeNames[kind]}: ${err}`;
    }
  }

  const loadStarts=(r.loads||[]).map(p=>({date:dateForStart(p),time:p.timeStart||''})).filter(x=>x.date);
  if(!loadStarts.length)return '';

  const firstLoadDate=loadStarts.map(x=>x.date).sort()[0];
  const firstLoadBoundary=loadStarts.filter(x=>x.date===firstLoadDate);
  const allLoadTimesGiven=firstLoadBoundary.every(x=>x.time);
  const firstLoadTime=allLoadTimesGiven?firstLoadBoundary.map(x=>x.time).sort()[0]:'';

  for(const p of (r.unloads||[])){
    const unloadEndDate=dateForEnd(p);
    if(!unloadEndDate)continue;
    if(unloadEndDate<firstLoadDate){
      return 'Rozładunek nie może kończyć się przed rozpoczęciem załadunku.';
    }
    if(unloadEndDate===firstLoadDate&&p.timeEnd&&firstLoadTime&&p.timeEnd<firstLoadTime){
      return `Rozładunek ${unloadEndDate.split('-').reverse().join('.')} kończy się o ${p.timeEnd}, przed rozpoczęciem załadunku o ${firstLoadTime}.`;
    }
  }
  return '';
}
function validatePointAgainstRoute(r,kind,p){
  const candidate={...r,loads:[...(r.loads||[])],stops:[...(r.stops||[])],unloads:[...(r.unloads||[])]};
  candidate[kind].push(p);
  return validateRouteDates(candidate);
}


function addNotification(kind,r,details=''){
  const c=getClient(r?.clientId)||{};
  const item={id:'n'+Date.now()+Math.random().toString(16).slice(2),createdAt:new Date().toISOString(),kind,requestId:r?.id||'',code:r?.code||'',client:c.company||'',clientEmail:c.email||r?.clientEmail||'',targetEmail:state.notifyEmail||defaults.notifyEmail,details,read:false};
  state.notifications.unshift(item);state.notifications=state.notifications.slice(0,80);store();
  if(state.notifyBrowser&&'Notification' in window&&Notification.permission==='granted'){
    try{new Notification(kind,{body:`${item.client||'Klient'} · ${item.code||''}${details?' · '+details:''}`});}catch(e){}
  }
  return item;
}
function unreadNotifications(){return state.notifications.filter(n=>!n.read).length}
function markNotificationsRead(){state.notifications.forEach(n=>n.read=true);store();render();toast('Powiadomienia oznaczone jako przeczytane.')}
function clearNotifications(){state.notifications.forEach(n=>cloudDeleted.notifications.add(n.id));state.notifications=[];store();render();toast('Powiadomienia wyczyszczone.')}
let notificationPollBusy=false;
async function refreshAdminBoard(){
  if(notificationPollBusy||!cloudOnline||!fbAuth?.currentUser||!fbDb||!isAdminEmail(fbAuth.currentUser.email||''))return;
  if(document.querySelector('.modal'))return;
  notificationPollBusy=true;
  try{
    const [requests,notifications]=await Promise.all([
      docsToArray(collection(fbDb,'requests')),
      docsToArray(collection(fbDb,'notifications'))
    ]);
    const previous=new Set(state.notifications.map(n=>n.id));
    const fresh=notifications.filter(n=>!previous.has(n.id)&&!n.read);
    state.requests=Array.isArray(requests)?requests:state.requests;
    state.requests.forEach(normalizeRequest);
    state.notifications=Array.isArray(notifications)?notifications:state.notifications;
    saveLocal();
    if(fresh.length&&state.notifyBrowser&&'Notification' in window&&Notification.permission==='granted'){
      try{new Notification('M.Kulczyk — nowe powiadomienie',{body:`${fresh[0].kind}${fresh[0].code?' · '+fresh[0].code:''}`});}catch(e){}
    }
    if(state.current?.role==='admin')render();
  }catch(e){console.warn('Notification refresh error',e)}
  finally{notificationPollBusy=false;}
}
setInterval(refreshAdminBoard,45000);

function requestBrowserNotifications(){if(!('Notification' in window)){toast('Ta przeglądarka nie obsługuje powiadomień systemowych.');return}Notification.requestPermission().then(p=>{state.notifyBrowser=p==='granted';store();render();toast(state.notifyBrowser?'Powiadomienia systemowe włączone.':'Powiadomienia systemowe nie zostały włączone.');})}
function demoNotifyAdmin(r,kind='Nowe zapytanie'){const to=(state.notifyEmail||'').trim();if(!to){toast('W ustawieniach wpisz e-mail do powiadomień administratora.');return}const c=getClient(r.clientId)||{};const subject=`${kind}: ${r.code||''}`;const body=`${kind}\n\nNumer: ${r.code||''}\nKlient: ${c.company||''}\nZaładunek: ${routeSummary(r.loads||[])}\nRozładunek: ${routeSummary(r.unloads||[])}\nWymagania: ${requirementsText(r)||'brak'}\nNotatka klienta: ${r.clientNote||'brak'}\nBudżet: ${r.budget||'brak'} ${r.currency||state.currency}`;window.location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;toast('Otworzono próbne powiadomienie. Wyślij je z programu pocztowego.')} 
function updateRequest(id){draftFromRow(id);const r=state.requests.find(x=>x.id===id);if(!r)return;const missing=[];if(!r.loads.length)missing.push('załadunek');if(!r.unloads.length)missing.push('rozładunek');if(!String(r.ldm||'').trim()&&!String(r.notes||'').trim())missing.push('LDM albo lista ładunkowa');if(String(r.weight||'').trim()==='')missing.push('waga');if(!r.access)missing.push('dostęp');if(missing.length){toast(`Uzupełnij pola wymagane: ${missing.join(', ')}.`);return}const dateError=validateRouteDates(r);if(dateError){toast(dateError);return}r.editing=false;r.submitted=true;r.status='waiting';normalizeRequest(r);addNotification('Nowe zgłoszenie klienta',r,'Klient wysłał nowe zapytanie.');store();render();demoNotifyAdmin(r,'Nowe zapytanie')} 
function clientNeedsDeleteReason(r){return state.current?.role==='client'&&['searching','offer','accepted'].includes(r.status)}
function openDeleteModal(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  const isAdmin=state.current?.role==='admin';
  const permanent=isAdmin&&r.status==='archived';
  const needsReason=clientNeedsDeleteReason(r);
  document.querySelector('.modal')?.remove();
  const options=needsReason?`<div class="delete-options"><label class="delete-option"><input type="radio" name="deleteReason" value="Transport już nieaktualny" checked><span>Transport już nieaktualny</span></label><label class="delete-option"><input type="radio" name="deleteReason" value="Będę potrzebował w innym okresie"><span>Będę potrzebował w innym okresie</span></label><label class="delete-option"><input type="radio" name="deleteReason" value="Inne"><span>Inne</span></label><input class="delete-other" id="deleteOtherReason" placeholder="Dopisz powód, jeżeli wybierasz inne"></div>`:'';
  const title=permanent?'Usunąć trwale zapis?':'Przenieść do archiwum?';
  const copy=permanent?'Tego działania nie będzie można cofnąć.':'Zapis nie zostanie trwale skasowany — trafi do archiwum widocznego dla klienta i administratora.';
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="deleteModal"><section class="modal-card delete-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>${title}</h2><p>${copy}</p>${needsReason?`<p>Podaj powód archiwizacji — administrator zobaczy go przy zapytaniu.</p>${options}`:''}<div class="modal-actions"><button class="btn" data-close-modal>Anuluj</button><button class="btn ${permanent?'danger':'red'}" data-confirm-delete="${esc(id)}">${permanent?'Usuń trwale':'Przenieś do archiwum'}</button></div></section></div>`);
}
function deleteReasonFromModal(){
  const picked=document.querySelector('input[name="deleteReason"]:checked')?.value||'';
  if(picked==='Inne')return String($('#deleteOtherReason')?.value||'Inne').trim()||'Inne';
  return picked;
}
function archiveRequest(id,reason=''){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  const prev=r.status||'waiting';
  r.archivedFrom=prev;r.archiveReason=reason||'Usunięto z listy';r.archivedAt=new Date().toISOString();r.archivedBy=state.current?.role||'user';
  r.status='archived';r.archiveNoticeConfirmed=false;r.budgetProposalPending=false;
  if(r.archivedBy==='client')addNotification('Klient przeniósł zapytanie do archiwum',r,`Powód: ${r.archiveReason||'nie podano'}`);
  store();document.querySelector('#deleteModal')?.remove();render();toast('Pozycja przeniesiona do archiwum.');
}
function permanentlyDeleteRequest(id){
  cloudDeleted.requests.add(id);
  state.requests=state.requests.filter(r=>r.id!==id);
  store();document.querySelector('#deleteModal')?.remove();render();toast('Pozycja trwale usunięta z archiwum.');
}
function confirmDeleteRequest(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  if(state.current?.role==='admin'&&r.status==='archived'){permanentlyDeleteRequest(id);return}
  archiveRequest(id,clientNeedsDeleteReason(r)?deleteReasonFromModal():'Usunięto po potwierdzeniu');
}
function confirmArchiveNotice(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.archiveNoticeConfirmed=true;store();render();toast('Powiadomienie archiwum potwierdzone. Pozycja jest oznaczona na szaro.')}
function deleteRequest(id){openDeleteModal(id)}
function editRequest(id){const r=state.requests.find(x=>x.id===id);if(r)openRequestWizard(id)}
function postalParts(p){
  const code=postalOnly((p&&p.postalCity)||(p&&p.address)||'');
  const m=code.match(/^([A-Z]{2})(.*)$/);
  return {country:m?(normalizeCountryCode(m[1])||m[1]):'PL',postal:m?m[2]:''};
}
function wizardPointTitle(kind,index){
  const label={loads:'Załadunek',stops:'Punkt pośredni',unloads:'Rozładunek'}[kind]||'Punkt';
  return index>0?`${label} ${index+1}`:label;
}
function wizardPointCard(kind,p,index,canRemove=false){
  const parts=postalParts(p||{});
  const examples={loads:{country:'DE',postal:'DE40472'},stops:{country:'DE',postal:'DE10115'},unloads:{country:'PL',postal:'PL80-180'}}[kind];
  const today=localToday();
  return `<article class="wizard-point-card" data-point-kind="${kind}" data-point-index="${index}"><div class="wizard-point-card-head"><div class="wizard-point-ident"><span class="wizard-point-no">${index+1}</span><span>${esc(wizardPointTitle(kind,index))}</span></div>${canRemove?`<button type="button" class="btn danger small remove-point" data-wizard-remove-point="${kind}">Usuń</button>`:''}</div><div class="wizard-location-grid"><label class="country-field">Kraj <b class="required-mark">*</b><input data-point-field="country" data-country-input autocomplete="off" placeholder="DE" value="${esc(parts.country||examples.country)}">${countryMenuMarkup()}</label><label>Kod pocztowy <b class="required-mark">*</b><input data-point-field="postal" inputmode="text" maxlength="12" autocomplete="postal-code" placeholder="np. ${examples.postal}" value="${esc(parts.postal)}"></label></div><div class="wizard-range-block no-title"><div><label>Data od<input data-point-field="dateStart" type="date" min="${today}" value="${esc((p&&p.dateStart)||'')}"></label><label>Data do<input data-point-field="dateEnd" type="date" min="${today}" value="${esc((p&&p.dateEnd)||'')}"></label></div></div><div class="wizard-range-block no-title"><div><label>Godzina od<input data-point-field="timeStart" type="time" value="${esc((p&&p.timeStart)||'')}"></label><label>Godzina do<input data-point-field="timeEnd" type="time" value="${esc((p&&p.timeEnd)||'')}"></label></div></div></article>`;
}
function wizardRouteSection(kind,points){
  const info={
    loads:{cls:'load-section',icon:'↑',title:'Załadunek',copy:'Gdzie odbieramy towar?',add:'+ Dodaj kolejny załadunek'},
    stops:{cls:'stop-section',icon:'↔',title:'Punkt pośredni',copy:'Dodaj tylko, gdy trasa wymaga zatrzymania po drodze.',add:'+ Dodaj kolejny punkt pośredni'},
    unloads:{cls:'unload-section',icon:'↓',title:'Rozładunek',copy:'Gdzie dostarczamy towar?',add:''}
  }[kind];
  const list=(points&&points.length?points:[{}]);
  if(kind==='stops'){
    const open=Boolean(points&&points.length);
    return `<section class="wizard-route-section ${info.cls} ${open?'is-open':'is-collapsed'}" id="wizardStopsSection"><div class="optional-stop-bar"><div><b>Punkt pośredni</b><span>Opcjonalnie — dodaj tylko, gdy transport ma postój po drodze.</span></div><button type="button" class="btn small section-add" data-wizard-show-stops>+ Dodaj punkt pośredni</button></div><div class="optional-stop-panel"><div class="wizard-section-head"><div class="wizard-section-title"><span class="wizard-section-icon">${info.icon}</span><div><h3>${info.title}</h3><p>${info.copy}</p></div></div><button type="button" class="btn small section-add" data-wizard-add-point="stops">${info.add}</button></div><div class="wizard-points" id="wizardStopsPoints">${open?list.map((p,i)=>wizardPointCard(kind,p,i,true)).join(''):''}</div><button type="button" class="btn small section-add more-stops" data-wizard-add-point="stops">${info.add}</button></div></section>`;
  }
  const allowMore=kind==='loads';
  return `<section class="wizard-route-section ${info.cls}"><div class="wizard-section-head"><div class="wizard-section-title"><span class="wizard-section-icon">${info.icon}</span><div><h3>${info.title}</h3><p>${info.copy}</p></div></div>${allowMore?`<button type="button" class="btn small section-add" data-wizard-add-point="loads">${info.add}</button>`:''}</div><div class="wizard-points" id="wizard${kind[0].toUpperCase()+kind.slice(1)}Points">${list.map((p,i)=>wizardPointCard(kind,p,i,allowMore&&i>0)).join('')}</div>${kind==='unloads'?'<p class="route-help">Możesz wpisać pełny adres — w tabeli wyświetli się tylko kraj i kod pocztowy.</p>':''}</section>`;
}
function wizardRouteMarkup(loads,stops,unloads){return `${wizardRouteSection('loads',loads)}${wizardRouteSection('stops',stops)}${wizardRouteSection('unloads',unloads)}`}
function wizardCheckboxes(r){const have=new Set(r.requirements||[]);return Object.entries(reqLabels).map(([key,label])=>`<label class="wizard-check"><input type="checkbox" value="${key}" ${have.has(key)?'checked':''} ${key==='temperature'?'data-wizard-temp':''}><span>${label}</span></label>`).join('')}
function wizardPointsFromDom(kind){
  return [...document.querySelectorAll(`#requestWizard .wizard-point-card[data-point-kind="${kind}"]`)].map(card=>{
    const field=name=>String(card.querySelector(`[data-point-field="${name}"]`)?.value||'').trim();
    const country=normalizeCountryCode(field('country'));
    const postalRaw=field('postal').toUpperCase().replace(/\s+/g,'');
    const postal=country&&postalRaw.startsWith(country)?postalRaw.slice(country.length):postalRaw;
    return {address:field('address'),postalCity:`${country}${postal}`,country,postal,dateStart:field('dateStart'),timeStart:field('timeStart'),dateEnd:field('dateEnd'),timeEnd:field('timeEnd'),type:kind==='stops'?'Punkt pośredni':'',__card:card};
  });
}
function cleanWizardPoint(p){const {__card,country,postal,...clean}=p;return clean}
function getWizardData(){
  const loads=wizardPointsFromDom('loads'),stops=wizardPointsFromDom('stops'),unloads=wizardPointsFromDom('unloads');
  const req=[...document.querySelectorAll('#requestWizard .wizard-check input:checked')].map(x=>x.value);
  return {loads:loads.map(cleanWizardPoint),stops:stops.map(cleanWizardPoint),unloads:unloads.map(cleanWizardPoint),ldm:normalizedLdm($('#wizLdm')?.value||''),weight:String($('#wizWeight')?.value||'').trim(),access:[...document.querySelectorAll('#wizAccessGroup input:checked')].map(x=>x.value).join(', '),notes:String($('#wizNotes')?.value||'').trim(),clientNote:String($('#wizClientNote')?.value||'').trim(),requirements:req,tempMin:String($('#wizTempMin')?.value||'').trim(),tempMax:String($('#wizTempMax')?.value||'').trim(),budget:String($('#wizBudget')?.value||'').trim(),currency:$('#wizCurrency')?.value||state.currency};
}
function clearWizardRouteErrors(){
  $('#wizardRouteError')?.classList.remove('show');
  $('#wizardRouteError')&&( $('#wizardRouteError').innerHTML='' );
  document.querySelectorAll('#requestWizard .wizard-field-error').forEach(el=>el.classList.remove('wizard-field-error'));
  document.querySelectorAll('#requestWizard .wizard-card-error').forEach(el=>el.classList.remove('wizard-card-error'));
}
function markWizardPointError(p,field){
  const card=p.__card;if(!card)return;
  card.classList.add('wizard-card-error');
  card.querySelector(`[data-point-field="${field}"]`)?.classList.add('wizard-field-error');
}
function showWizardRouteError(items){
  const box=$('#wizardRouteError');if(!box)return;
  box.innerHTML=`<b>Nie można przejść dalej — uzupełnij zaznaczone pola.</b><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  box.classList.add('show');
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function validateWizardStep(step){
  if(step===1){
    clearWizardRouteErrors();
    const raw={loads:wizardPointsFromDom('loads'),stops:wizardPointsFromDom('stops'),unloads:wizardPointsFromDom('unloads')};
    const issues=[];
    const groups=[['loads','załadunek',true],['stops','punkt pośredni',false],['unloads','rozładunek',true]];
    for(const [kind,label,required] of groups){
      if(required&&!raw[kind].length){issues.push(`Dodaj co najmniej jeden: ${label}.`);continue}
      raw[kind].forEach((p,index)=>{
        const prefix=`${label}${raw[kind].length>1?` ${index+1}`:''}`;
        if(!p.country||!/^[A-Z]{2}$/.test(p.country)){markWizardPointError(p,'country');issues.push(`${prefix}: wpisz 2-literowy kod kraju.`)}
        if(!p.postal||!validPostalCode(p.postalCity)){markWizardPointError(p,'postal');issues.push(`${prefix}: wpisz prawidłowy kod pocztowy.`)}
        if(!p.dateStart){markWizardPointError(p,'dateStart');issues.push(`${prefix}: wpisz datę „od”.`)}
        const dateLimitError=validatePointNotPast(p);
        if(dateLimitError){markWizardPointError(p,'dateStart');markWizardPointError(p,'dateEnd');issues.push(`${prefix}: ${dateLimitError}`)}
        const localDateError=validatePointDateRange(p,kind);
        if(localDateError){markWizardPointError(p,'dateStart');markWizardPointError(p,'dateEnd');issues.push(`${prefix}: ${localDateError}`)}
      });
    }
    if(issues.length){showWizardRouteError([...new Set(issues)]);toast('Uzupełnij pola zaznaczone na czerwono. Daty muszą być dzisiejsze lub przyszłe.');return false}
    const clean={loads:raw.loads.map(cleanWizardPoint),stops:raw.stops.map(cleanWizardPoint),unloads:raw.unloads.map(cleanWizardPoint)};
    const e=validateRouteDates(clean);if(e){showWizardRouteError([e]);toast(e);return false}
  }
  if(step===2){
    const missing=[];
    const ldmEl=$('#wizLdm'), notesEl=$('#wizNotes'), weightEl=$('#wizWeight');
    const hasLdm=Boolean(String(ldmEl?.value||'').trim());
    const hasNotes=Boolean(String(notesEl?.value||'').trim());
    if(!hasLdm&&!hasNotes){ldmEl?.classList.add('wizard-field-error');notesEl?.classList.add('wizard-field-error');missing.push('LDM albo listę ładunkową')}
    if(!String(weightEl?.value||'').trim()){weightEl?.classList.add('wizard-field-error');missing.push('wagę')}
    const accessGroup=$('#wizAccessGroup');if(!accessGroup?.querySelector('input:checked')){accessGroup?.classList.add('wizard-field-error');missing.push('stronę ładowania')}
    if(missing.length){toast(`Uzupełnij pola wymagane: ${missing.join(', ')}.`);return false}
  }
  return true;
}
function addWizardPoint(kind){
  const section=kind==='stops'?$('#wizardStopsSection'):null;
  if(section&&section.classList.contains('is-collapsed')){section.classList.remove('is-collapsed');section.classList.add('is-open')}
  const holder=kind==='stops'?$('#wizardStopsPoints'):$('#wizardLoadsPoints');
  if(!holder)return;
  const index=holder.querySelectorAll('.wizard-point-card').length;
  holder.insertAdjacentHTML('beforeend',wizardPointCard(kind,{},index,kind==='stops'||index>0));
  holder.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function removeWizardPoint(button){
  const card=button.closest('.wizard-point-card');const holder=card?.parentElement;if(!card||!holder)return;
  card.remove();
  [...holder.querySelectorAll('.wizard-point-card')].forEach((item,i)=>{item.dataset.pointIndex=String(i);item.querySelector('.wizard-point-no').textContent=String(i+1);const title=item.querySelector('.wizard-point-ident>span:nth-child(2)');if(title)title.textContent=wizardPointTitle(item.dataset.pointKind,i);});
  if(holder.id==='wizardStopsPoints'&&!holder.children.length){$('#wizardStopsSection')?.classList.remove('is-open');$('#wizardStopsSection')?.classList.add('is-collapsed')}
}
function setWizardStep(step){
  const modal=$('#requestWizard');if(!modal)return;const current=Number(modal.dataset.step||1);if(step>current&&!validateWizardStep(current))return;
  modal.dataset.step=String(step);
  modal.querySelectorAll('.wizard-step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===step));
  modal.querySelectorAll('.wizard-progress span').forEach(x=>x.classList.toggle('active',Number(x.dataset.progress)<=step));
  modal.querySelector('[data-wizard-prev]').classList.toggle('hidden',step===1);
  modal.querySelector('[data-wizard-next]').classList.toggle('hidden',step===3);
  modal.querySelector('[data-wizard-save]').classList.toggle('hidden',step!==3);
}
function openRequestWizard(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;normalizeRequest(r);
  const loads=(r.loads&&r.loads.length)?r.loads:[{}];const stops=r.stops||[];const unloads=(r.unloads&&r.unloads.length)?r.unloads:[{}];
  document.querySelector('.modal')?.remove();
  const currs=['PLN','EUR','GBP'];
  const html=`<div class="modal request-modal" id="requestWizard" data-id="${esc(id)}" data-step="1">${countryOptionsMarkup()}<section class="modal-card wizard-card"><button class="modal-close" aria-label="Zamknij" data-wizard-cancel="${esc(id)}">×</button><div class="wizard-title"><div><span class="wizard-kicker">NOWE ZAPYTANIE</span><h2>${esc(r.code)}</h2><p>Wprowadź trasę krok po kroku. </p></div><div class="wizard-progress"><span data-progress="1"><small>Trasa</small></span><i></i><span data-progress="2"><small>Ładunek</small></span><i></i><span data-progress="3"><small>Budżet</small></span></div></div><div class="wizard-step active" data-step="1"><div class="wizard-intro"><h3>Trasa i okna czasowe</h3><p>Podaj kraj, kod pocztowy, daty i godziny. Nowe zapytanie może dotyczyć wyłącznie dzisiejszych lub przyszłych terminów.</p></div><div class="wizard-route-error" id="wizardRouteError" role="alert" aria-live="polite"></div><div class="wizard-route-stack">${wizardRouteMarkup(loads,stops,unloads)}</div></div><div class="wizard-step" data-step="2"><div class="wizard-intro"><h3>Ładunek i wymagania</h3></div><div class="wizard-grid three"><label>LDM [m] <span class="help-tip" title="Jeżeli nie znasz LDM ładunku, wpisz przynajmniej pozycje na listę ładunkową zgodnie z realnymi wymiarami.">?</span><input id="wizLdm" inputmode="decimal" placeholder="np. 2,4" value="${esc(ldmDisplay(r.ldm))}"></label><label>Waga (t) *<input id="wizWeight" inputmode="decimal" placeholder="np. 1,2" value="${esc(r.weight||'')}"></label>${wizardAccessMarkup(r.access)}</div><label class="wizard-label">Lista ładunkowa / opis <textarea id="wizNotes" rows="4" maxlength="500" placeholder="Np. 4 palety EUR, towar neutralny">${esc(r.notes||'')}</textarea></label><h4 class="wizard-section-label">Wymagania dodatkowe <span>opcjonalnie</span></h4><div class="wizard-check-grid">${wizardCheckboxes(r)}</div><div id="wizTempRange" class="wizard-grid two ${((r.requirements||[]).includes('temperature'))?'':'hidden'}"><label>Temperatura od<input id="wizTempMin" type="number" step="0.1" value="${esc(r.tempMin||'')}"></label><label>Temperatura do<input id="wizTempMax" type="number" step="0.1" value="${esc(r.tempMax||'')}"></label></div></div><div class="wizard-step" data-step="3"><div class="wizard-intro"><h3>Budżet i informacja dla spedytora</h3><p>Budżet jest opcjonalny. Brak budżetu nie blokuje wysłania zapytania.</p></div><div class="wizard-grid two"><label>Budżet <span class="help-tip" title="Budżet jest opcjonalny. Brak budżetu nie blokuje wysłania zapytania.">?</span><input id="wizBudget" inputmode="decimal" placeholder="np. 1800" value="${esc(r.budget||'')}"></label><label>Waluta<select id="wizCurrency">${currs.map(x=>`<option ${(r.currency||state.currency)===x?'selected':''}>${x}</option>`).join('')}</select></label></div><label class="wizard-label">Notatka dla spedytora <span>opcjonalnie</span><textarea id="wizClientNote" rows="5" maxlength="500" placeholder="Informacje dodatkowe dotyczące zapytania.">${esc(r.clientNote||'')}</textarea></label><div class="wizard-ready"><b>Gotowe do wysłania</b><span>Po zapisie zapytanie otrzyma status „Oczekujące” i pojawi się w panelu spedytora.</span></div></div><div class="wizard-footer"><button class="btn" data-wizard-cancel="${esc(id)}">Anuluj</button><div><button class="btn" data-wizard-prev>Wstecz</button><button class="btn red" data-wizard-next>Dalej</button><button class="btn red hidden" data-wizard-save="${esc(id)}">Zapisz zapytanie</button></div></div></section></div>`;
  document.body.insertAdjacentHTML('beforeend',html);setWizardStep(1);
}
function closeRequestWizard(id){const r=state.requests.find(x=>x.id===id);if(r?.isNewDraft&&!r.submitted)state.requests=state.requests.filter(x=>x.id!==id);store();$('#requestWizard')?.remove();render();}
function saveRequestWizard(id){
  if(!validateWizardStep(1)||!validateWizardStep(2))return;
  const r=state.requests.find(x=>x.id===id);if(!r)return;const data=getWizardData();
  Object.assign(r,data,{submitted:true,isNewDraft:false,editing:false,status:'waiting',budgetProposalPending:false});
  if(!r.requirements.includes('temperature')){r.tempMin='';r.tempMax=''}
  addNotification('Nowe zgłoszenie klienta',r,'Klient wysłał nowe zapytanie.');store();$('#requestWizard')?.remove();render();toast('Zapytanie zapisane. Status: Oczekujące.');
}
function openRouteModal(id,kind){
  draftFromRow(id);
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  normalizeRequest(r);
  const points=r[kind];const kindLabel=routeNames[kind];
  const addedIndex=r.lastAddedPoint&&r.lastAddedPoint.kind===kind?r.lastAddedPoint.index:-1;
  const pointRows=points.length?points.map((p,i)=>`<div class="point-item ${i===addedIndex?'added':''}"><div title="${esc(onePointSummary(p))}">${esc(onePointSummary(p))}</div><button class="btn danger small" data-remove-route-point="${esc(id)}" data-route-kind="${kind}" data-route-index="${i}">Usuń</button></div>`).join(''):`<div class="info">Brak dodanych punktów.</div>`;
  const stopType=kind==='stops'?`<label class="point-type">Rodzaj<select id="routeType"><option value=""></option>${['Waga','Odprawa celna','Kontrola','Inne'].map(x=>`<option>${x}</option>`).join('')}</select></label>`:'';
  const addedStatus=addedIndex>=0?`<div class="point-added-status"><span class="tick">✓</span>Dodano punkt: ${esc(onePointSummary(points[addedIndex]))}</div>`:'';
  document.querySelector('.modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="routeModal"><section class="modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>${kindLabel}</h2><div class="point-form">${stopType}<div class="postal-row"><label>Kod pocztowy<input id="routePostalCity" maxlength="16" autocomplete="postal-code" placeholder="DE40472"></label></div><div class="date-row"><label>Data od<input id="routeDateStart" type="date"></label><label>Godzina od<input id="routeTimeStart" type="time"></label><label>Data do<input id="routeDateEnd" type="date"></label><label>Godzina do<input id="routeTimeEnd" type="time"></label></div></div><div class="modal-actions"><button class="btn red" data-add-route-point="${esc(id)}" data-route-kind="${kind}">Dodaj punkt</button></div>${addedStatus}<div class="point-list">${pointRows}</div></section></div>`)
}
function addRoutePoint(id,kind){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  const code=postalOnly($('#routePostalCity').value);
  const p={address:'',postalCity:code,dateStart:$('#routeDateStart').value,timeStart:$('#routeTimeStart').value,dateEnd:$('#routeDateEnd').value,timeEnd:$('#routeTimeEnd').value,type:kind==='stops'?$('#routeType').value:''};
  if(!validPostalCode(code)){toast('Wpisz kod w formacie DE40472 lub PL80-180. Kod kraju musi być wielkimi literami.');return}
  if(!p.dateStart){toast('Wpisz datę „od”.');return}
  const futureError=validatePointNotPast(p);if(futureError){toast(futureError);return}
  const dateError=validatePointDateRange(p,kind);if(dateError){toast(dateError);return}
  const routeError=validatePointAgainstRoute(r,kind,p);if(routeError){toast(routeError);return}
  r[kind].push(p);r.lastAddedPoint={kind,index:r[kind].length-1};
  store();openRouteModal(id,kind);render();toast('Dodano punkt.');
}
function removeRoutePoint(id,kind,index){const r=state.requests.find(x=>x.id===id);if(!r)return;r[kind].splice(Number(index),1);store();openRouteModal(id,kind);render()}
function requirementsModal(id){draftFromRow(id);const r=state.requests.find(x=>x.id===id);if(!r)return;const have=new Set(r.requirements||[]);const checks=Object.entries(reqLabels).map(([key,label])=>`<label class="check"><input type="checkbox" value="${key}" ${have.has(key)?'checked':''} ${key==='temperature'?'data-temp-toggle':''}><span>${label}</span></label>`).join('');document.querySelector('.modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="requirementsModal"><section class="modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Wymagania</h2><div class="check-grid">${checks}</div><div id="tempRange" class="temp-range ${have.has('temperature')?'':'hidden'}"><label>Temperatura od<input id="tempMin" type="number" step="0.1" value="${esc(r.tempMin||'')}"></label><label>Temperatura do<input id="tempMax" type="number" step="0.1" value="${esc(r.tempMax||'')}"></label></div><div class="modal-actions"><button class="btn red" data-save-requirements="${esc(id)}">Zapisz wymagania</button></div></section></div>`) }
function saveRequirements(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.requirements=[...document.querySelectorAll('#requirementsModal input[type="checkbox"]:checked')].map(x=>x.value);r.tempMin=$('#tempMin')?.value||'';r.tempMax=$('#tempMax')?.value||'';if(!r.requirements.includes('temperature')){r.tempMin='';r.tempMax=''}store();document.querySelector('#requirementsModal')?.remove();render();toast('Wymagania zapisane.')}
function openBudgetModal(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  document.querySelector('.modal')?.remove();
  const currs=['PLN','EUR','GBP'];
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="budgetModal"><section class="modal-card budget-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Zaproponuj cenę</h2><p>Klient otrzyma wyłącznie nową cenę i walutę do potwierdzenia.</p><div class="budget-modal-fields"><label>Cena<input id="proposalBudget" inputmode="decimal" autofocus placeholder="np. 1800" value="${esc(r.status==='counter'?(r.clientProposal||''):(r.budget||''))}"></label><label>Waluta<select id="proposalCurrency">${currs.map(x=>`<option ${(r.status==='counter'?(r.clientProposalCurrency||r.currency):r.currency)===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="modal-actions"><button class="btn red" data-submit-budget-proposal="${esc(id)}">Wyślij cenę do klienta</button></div></section></div>`);
}
function proposeBudget(id){openBudgetModal(id);return true}
function submitBudgetProposal(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  const budget=$('#proposalBudget')?.value.trim()||'';
  const currency=$('#proposalCurrency')?.value||state.currency;
  if(!budget){toast('Wpisz cenę przed wysłaniem propozycji.');return}
  r.budget=budget;r.currency=currency;r.status='budget';r.budgetProposalPending=true;r.clientProposal='';r.clientProposalCurrency=currency;
  store();document.querySelector('#budgetModal')?.remove();render();toast('Cena została wysłana klientowi do potwierdzenia.');
}
function acceptBudget(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  r.status='budgetAccepted';r.budgetProposalPending=false;
  addNotification('Klient potwierdził cenę',r,`${r.budget||''} ${r.currency||state.currency}`);
  store();render();toast('Cena potwierdzona. Spedytor może rozpocząć przygotowanie oferty.');
}
function confirmBudget(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  if(!String(r.budget||'').trim()){openBudgetModal(id);return}
  r.status='searching';r.budgetProposalPending=false;
  store();render();toast('Budżet potwierdzony. Status: Oferta w przygotowaniu.');
}
function declineBudgetProposal(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.status='cancelled';r.budgetProposalPending=false;if(state.current?.role==='client')addNotification('Klient odrzucił propozycję ceny',r,`${r.budget||''} ${r.currency||state.currency}`);store();render();toast('Propozycja ceny została odrzucona.')} 
function openCounterBudgetModal(id){const r=state.requests.find(x=>x.id===id);if(!r)return;document.querySelector('.modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="counterBudgetModal"><section class="modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Proponowana cena</h2><p>Podaj własną propozycję. Spedytor zobaczy ją jako negocjację ceny.</p><div class="point-form"><label>Cena<input id="counterBudget" inputmode="decimal" value="${esc(r.budget||'')}"></label><label>Waluta<select id="counterCurrency">${['PLN','EUR','GBP'].map(x=>`<option ${r.currency===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="modal-actions"><button class="btn red" data-submit-counter="${esc(id)}">Wyślij propozycję</button></div></section></div>`) }
function submitCounterBudget(id){const r=state.requests.find(x=>x.id===id);if(!r)return;const budget=$('#counterBudget')?.value.trim()||'';const currency=$('#counterCurrency')?.value||state.currency;if(!budget){toast('Wpisz proponowaną cenę.');return}r.clientProposal=budget;r.clientProposalCurrency=currency;r.status='counter';r.budgetProposalPending=false;addNotification('Klient zaproponował własną cenę',r,`${budget} ${currency}`);store();document.querySelector('#counterBudgetModal')?.remove();render();toast('Propozycja klienta została wysłana do spedytora.')} 
function approveCounter(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.budget=r.clientProposal||r.budget;r.currency=r.clientProposalCurrency||r.currency;r.clientProposal='';r.clientProposalCurrency=r.currency;r.status='searching';r.budgetProposalPending=false;store();render();toast('Budżet potwierdzony. Status: Oferta w przygotowaniu.')} 
function declineCounter(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.status='cancelled';r.budgetProposalPending=false;store();render();toast('Negocjacja ceny została odrzucona.')}
function setOfferSent(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.status='offer';r.budgetProposalPending=false;store();render();toast('Status zmieniony: Oferta wysłana.');}
function startRealisation(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.status='accepted';r.budgetProposalPending=false;store();render();toast('Status zmieniony: W realizacji.');}
function formatOfferPoint(p,lang='pl'){
  const parts=postalParts(p||{});
  const date=pointDates(p)||'—';
  const time=pointTimes(p)||'—';
  if(lang==='en')return `Date: ${date}
Time: ${time}
Country: ${parts.country||'—'}
Postal code: ${parts.postal||'—'}`;
  if(lang==='de')return `Datum: ${date}
Uhrzeit: ${time}
Land: ${parts.country||'—'}
Postleitzahl: ${parts.postal||'—'}`;
  return `Data: ${date}
Godzina: ${time}
Kraj: ${parts.country||'—'}
Kod pocztowy: ${parts.postal||'—'}`;
}
function routeBlock(label,points,lang='pl'){
  const body=(points||[]).map(p=>formatOfferPoint(p,lang)).join('\n\n')||'—';
  return `${label}\n${body}`;
}
function cargoText(r,lang='pl'){
  const access=accessValues(r.access).join(', ')||'—';
  if(lang==='en')return `Cargo details\nLDM: ${ldmDisplay(r.ldm)||'—'}\nWeight: ${r.weight?`${r.weight} t`:'—'}\nLoading side: ${access}`;
  if(lang==='de')return `Ladungsdaten\nLDM: ${ldmDisplay(r.ldm)||'—'}\nGewicht: ${r.weight?`${r.weight} t`:'—'}\nLadeseite: ${access}`;
  return `Ładunek\nLDM: ${ldmDisplay(r.ldm)||'—'}\nWaga: ${r.weight?`${r.weight} t`:'—'}\nStrona ładowania: ${access}`;
}
function offerEmailBody(r,lang='pl'){
  const c=getClient(r.clientId)||{};
  const reg=formatRegisteredAt(r.createdAt);
  const req=requirementsText(r)||'';
  const note=r.clientNote||r.notes||'';
  const price=r.budget?`${r.budget} ${r.currency||state.currency}`:'';
  if(lang==='en'){
    const blocks=['Good morning,',`With reference to inquiry ${r.code||''}, please find our offer below.`,'',`Inquiry ${r.code||''} was submitted on ${reg}.`,`Customer: ${c.company||'—'}${c.contact?` / ${c.contact}`:''}`];
    blocks.push(routeBlock('Loading',r.loads,lang));
    if((r.stops||[]).length)blocks.push(routeBlock('Intermediate point',r.stops,lang));
    blocks.push(routeBlock('Unloading',r.unloads,lang));
    blocks.push(cargoText(r,lang));
    blocks.push(`Additional requirements\n${req||'None'}`);
    if(note)blocks.push(`Notes\n${note}`);
    if(price)blocks.push(`Offered price\n${price}`);
    blocks.push('Please confirm by e-mail if the offer is accepted.');
    return blocks.join('\n\n');
  }
  if(lang==='de'){
    const blocks=['Guten Tag,',`bezugnehmend auf die Anfrage ${r.code||''} unterbreite ich Ihnen nachfolgend unser Angebot.`,'',`Die Anfrage ${r.code||''} wurde am ${reg} übermittelt.`,`Kunde: ${c.company||'—'}${c.contact?` / ${c.contact}`:''}`];
    blocks.push(routeBlock('Beladung',r.loads,lang));
    if((r.stops||[]).length)blocks.push(routeBlock('Zwischenpunkt',r.stops,lang));
    blocks.push(routeBlock('Entladung',r.unloads,lang));
    blocks.push(cargoText(r,lang));
    blocks.push(`Zusätzliche Anforderungen\n${req||'Keine'}`);
    if(note)blocks.push(`Notiz\n${note}`);
    if(price)blocks.push(`Angebotspreis\n${price}`);
    blocks.push('Bitte bestätigen Sie per E-Mail, ob das Angebot akzeptiert wird.');
    return blocks.join('\n\n');
  }
  const blocks=['Dzień dobry,',`W nawiązaniu do zgłoszenia ${r.code||''} przedstawiam poniższą ofertę.`,'',`Zgłoszenie ${r.code||''} przesłano ${reg}.`,`Klient: ${c.company||'—'}${c.contact?` / ${c.contact}`:''}`];
  blocks.push(routeBlock('Załadunek',r.loads,lang));
  if((r.stops||[]).length)blocks.push(routeBlock('Punkt pośredni',r.stops,lang));
  blocks.push(routeBlock('Rozładunek',r.unloads,lang));
  blocks.push(cargoText(r,lang));
  blocks.push(`Wymagania\n${req||'Brak'}`);
  if(note)blocks.push(`Notatka\n${note}`);
  if(price)blocks.push(`Cena ofertowa\n${price}`);
  blocks.push('Proszę o potwierdzenie mailowe, czy oferta jest akceptowalna.');
  return blocks.join('\n\n');
}
function offerSubject(r){return `Oferta ${r.code||''} ${formatRegisteredAt(r.createdAt)}`}
function sendOfferMail(id,lang='pl'){
  const r=state.requests.find(x=>x.id===id),c=r&&getClient(r.clientId);if(!r||!c)return;
  const subject=offerSubject(r);
  window.location.href=`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(offerEmailBody(r,lang))}`;
  toast(`Otworzono e-mail z ofertą ${String(lang||'pl').toUpperCase()}.`);
}
function openStatusModal(id){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  const allowed=['waiting','budget','budgetAccepted','searching','offer','accepted','finalized','cancelled','archived'];
  document.querySelector('.modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="statusModal"><section class="modal-card status-modal-card"><button class="modal-close" aria-label="Zamknij" data-close-modal>×</button><h2>Zmień status</h2><p>${esc(r.code||'')}</p><label>Status<select id="adminStatusChoice">${allowed.map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></label><div class="modal-actions"><button class="btn red" data-save-status="${esc(id)}">Zapisz status</button></div></section></div>`);
}
function setAdminStatus(id,status){
  const r=state.requests.find(x=>x.id===id);if(!r)return;
  if(status==='archived'&&r.status!=='archived'){r.archivedFrom=r.status;r.archiveReason='Przeniesiono do archiwum przez admina';r.archivedAt=new Date().toISOString();r.archivedBy='admin';r.archiveNoticeConfirmed=true;}
  if(status!=='archived'){r.archiveNoticeConfirmed=false;}
  r.status=status;r.budgetProposalPending=status==='budget'&&Boolean(String(r.budget||'').trim());
  if(status!=='budget')r.budgetProposalPending=false;
  store();document.querySelector('#statusModal')?.remove();render();toast(`Status zmieniony: ${statusLabel(status)}.`);
}
function testMail(){const sample={code:'TEST-001',clientId:state.clients[0]?.id,loads:[],unloads:[],budget:'',currency:state.currency};demoNotifyAdmin(sample,'Próba powiadomienia')} 

function openCountryMenu(input){
  const field=input.closest('.country-field');if(!field)return;
  document.querySelectorAll('.country-field.open').forEach(x=>{if(x!==field)x.classList.remove('open')});
  field.classList.add('open');filterCountryMenu(input);
}
function filterCountryMenu(input){
  const field=input.closest('.country-field');if(!field)return;
  const q=String(input.value||'').toLocaleLowerCase('pl-PL').replace('—',' ').trim();
  field.querySelectorAll('.country-option').forEach(btn=>{
    const txt=btn.textContent.toLocaleLowerCase('pl-PL');
    btn.style.display=!q||txt.includes(q)?'flex':'none';
  });
}
function closeCountryMenus(){document.querySelectorAll('.country-field.open').forEach(x=>x.classList.remove('open'))}
document.addEventListener('click',e=>{const opt=e.target.closest('[data-country-code]');if(opt){const field=opt.closest('.country-field');const input=field?.querySelector('[data-country-input]');if(input){input.value=opt.dataset.countryCode;input.classList.remove('wizard-field-error');field.classList.remove('open');}return}if(!e.target.closest('.country-field'))closeCountryMenus();});
document.addEventListener('click',e=>{const a=e.target.closest('[data-account-sort-key]');if(a){const key=a.dataset.accountSortKey;const ui=tableUi.accounts;if(ui.key===key)ui.dir=ui.dir==='asc'?'desc':'asc';else{ui.key=key;ui.dir='asc'}render();return}const t=e.target.closest('[data-sort-key]');if(!t)return;const role=t.dataset.sortRole,key=t.dataset.sortKey;if(!role||!key)return;const ui=tableUi[role];if(ui.key===key)ui.dir=ui.dir==='asc'?'desc':'asc';else{ui.key=key;ui.dir=key==='createdAt'?'desc':'asc'}render();applyTableSearch(role,ui.query);});
document.addEventListener('click',e=>{const t=e.target.closest('button,[data-quick]');if(!t)return;if(t.dataset.quick){login(t.dataset.quick);return}if(t.hasAttribute('data-open-login')){loginModal();return}if(t.hasAttribute('data-add-client')){openClientAddModal();return}if(t.dataset.action==='logout'){logout();return}if(t.dataset.action==='add-request'){addRequest();return}if(t.dataset.nav){state.view=t.dataset.nav;render();return}if(t.hasAttribute('data-profile')){state.view='profile';render();return}if(t.dataset.lang){state.lang=t.dataset.lang;try{const url=new URL(location.href);url.searchParams.set('lang',state.lang);history.replaceState(null,'',url.toString())}catch(e){}store();render();return}if(t.dataset.save){updateRequest(t.dataset.save);return}if(t.dataset.delete){deleteRequest(t.dataset.delete);return}if(t.dataset.confirmDelete){confirmDeleteRequest(t.dataset.confirmDelete);return}if(t.dataset.confirmArchiveNotice){confirmArchiveNotice(t.dataset.confirmArchiveNotice);return}if(t.hasAttribute('data-add-user-info')){openAddUserInfo();return}if(t.hasAttribute('data-edit-profile')){openProfileEditModal();return}if(t.hasAttribute('data-save-profile')){saveProfile();return}if(t.dataset.editClient){openClientEditModal(t.dataset.editClient);return}if(t.dataset.deleteClient){openDeleteClientModal(t.dataset.deleteClient);return}if(t.dataset.confirmDeleteClient){confirmDeleteClient(t.dataset.confirmDeleteClient);return}if(t.dataset.saveClient){saveClientAccount(t.dataset.saveClient);return}if(t.hasAttribute('data-mark-notifications-read')){markNotificationsRead();return}if(t.hasAttribute('data-clear-notifications')){clearNotifications();return}if(t.hasAttribute('data-enable-browser-notify')){requestBrowserNotifications();return}if(t.dataset.edit){editRequest(t.dataset.edit);return}if(t.dataset.routeId){openRouteModal(t.dataset.routeId,t.dataset.routeKind);return}if(t.dataset.addRoutePoint){addRoutePoint(t.dataset.addRoutePoint,t.dataset.routeKind);return}if(t.dataset.removeRoutePoint){removeRoutePoint(t.dataset.removeRoutePoint,t.dataset.routeKind,t.dataset.routeIndex);return}if(t.dataset.requirements){requirementsModal(t.dataset.requirements);return}if(t.dataset.saveRequirements){saveRequirements(t.dataset.saveRequirements);return}if(t.dataset.acceptBudget){acceptBudget(t.dataset.acceptBudget);return}if(t.dataset.declineBudget){declineBudgetProposal(t.dataset.declineBudget);return}if(t.dataset.counterBudget){openCounterBudgetModal(t.dataset.counterBudget);return}if(t.dataset.submitCounter){submitCounterBudget(t.dataset.submitCounter);return}if(t.dataset.submitBudgetProposal){submitBudgetProposal(t.dataset.submitBudgetProposal);return}if(t.dataset.openStatus){openStatusModal(t.dataset.openStatus);return}if(t.dataset.saveStatus){setAdminStatus(t.dataset.saveStatus,$('#adminStatusChoice')?.value||'waiting');return}if(t.dataset.offerSent){setOfferSent(t.dataset.offerSent);return}if(t.dataset.startRealisation){startRealisation(t.dataset.startRealisation);return}if(t.dataset.openOfferMailLangs){openOfferMailLangModal(t.dataset.openOfferMailLangs);return}if(t.dataset.sendOfferMail){sendOfferMail(t.dataset.sendOfferMail,t.dataset.mailLang||state.lang||'pl');return}if(t.dataset.approveCounter){approveCounter(t.dataset.approveCounter);return}if(t.dataset.declineCounter){declineCounter(t.dataset.declineCounter);return}if(t.hasAttribute('data-test-mail')){testMail();return}if(t.dataset.copy){const r=state.requests.find(x=>x.id===t.dataset.copy);if(r){navigator.clipboard?.writeText(`${r.code}\n${routeSummary(r.loads)}\n${routeSummary(r.unloads)}\nLDM: ${ldmDisplay(r.ldm)} | Waga: ${r.weight||''} t`);toast('Szkic oferty skopiowany.')}return}if(t.dataset.mail){const r=state.requests.find(x=>x.id===t.dataset.mail),c=r&&getClient(r.clientId);if(r&&c)window.location.href=`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent('Zapytanie '+r.code)}&body=${encodeURIComponent('Dzień dobry,\n\nstatus zapytania '+r.code+': '+statusLabel(r.status)+'.')}`;return}if(t.hasAttribute('data-close-modal')){document.querySelector('.modal')?.remove();return}});
document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.wizardAddPoint){addWizardPoint(t.dataset.wizardAddPoint);return}if(t.hasAttribute('data-wizard-show-stops')){const section=$('#wizardStopsSection');if(section){section.classList.remove('is-collapsed');section.classList.add('is-open');if(!$('#wizardStopsPoints')?.children.length)addWizardPoint('stops')}return}if(t.dataset.wizardRemovePoint){removeWizardPoint(t);return}if(t.hasAttribute('data-wizard-next')){setWizardStep(Number($('#requestWizard')?.dataset.step||1)+1);return}if(t.hasAttribute('data-wizard-prev')){setWizardStep(Math.max(1,Number($('#requestWizard')?.dataset.step||1)-1));return}if(t.dataset.wizardSave){saveRequestWizard(t.dataset.wizardSave);return}if(t.dataset.wizardCancel){closeRequestWizard(t.dataset.wizardCancel);return}});
document.addEventListener('change',e=>{if(e.target.matches('[data-wizard-temp]'))$('#wizTempRange')?.classList.toggle('hidden',!e.target.checked)});
function updateFieldColour(el){if(!el.matches('[name="ldm"],[name="weight"],[name="access"]'))return;const empty=String(el.value||'').trim()==='';el.classList.toggle('missing-strong',empty)}
document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.proposeBudget){proposeBudget(t.dataset.proposeBudget);return}if(t.dataset.confirmBudget){confirmBudget(t.dataset.confirmBudget);return}if(t.dataset.declineApprovedBudget){declineBudgetProposal(t.dataset.declineApprovedBudget);return}});
document.addEventListener('input',e=>{if(e.target.matches('[data-table-search]')){const role=e.target.dataset.tableSearch;tableUi[role].query=e.target.value;applyTableSearch(role,e.target.value);return}if(e.target.matches('[data-account-search]')){const pos=e.target.selectionStart||0;tableUi.accounts.query=e.target.value;render();setTimeout(()=>{const el=document.querySelector('[data-account-search]');if(el){el.focus();try{el.setSelectionRange(pos,pos)}catch(e){}}},0);return}if(e.target.matches('[data-country-input]')){const raw=e.target.value.toUpperCase();if(e.target.value!==raw)e.target.value=raw;openCountryMenu(e.target);return}if(e.target.id==='routePostalCity'){const raw=e.target.value;const upper=raw.toUpperCase();if(raw!==upper)e.target.value=upper;}if(e.target.matches('[data-point-field="postal"]')){const raw=e.target.value;const upper=raw.toUpperCase();if(raw!==upper)e.target.value=upper;}if(e.target.matches('#wizAccessGroup input')){$('#wizAccessGroup')?.classList.remove('wizard-field-error')}if(e.target.closest('#requestWizard')&&e.target.matches('[data-point-field],#wizLdm,#wizNotes,#wizWeight,#wizAccessGroup input')){e.target.classList.remove('wizard-field-error');const card=e.target.closest('.wizard-point-card');if(card&&!card.querySelector('.wizard-field-error'))card.classList.remove('wizard-card-error');}updateFieldColour(e.target)});
document.addEventListener('focusin',e=>{if(e.target.matches('[data-country-input]'))openCountryMenu(e.target);},true);
document.addEventListener('change',e=>{if(e.target.matches('[data-point-field="country"]')){const code=normalizeCountryCode(e.target.value);if(code)e.target.value=code;}if(e.target.matches('[data-temp-toggle]')){$('#tempRange')?.classList.toggle('hidden',!e.target.checked)}if(e.target.dataset.adminStatus){setAdminStatus(e.target.dataset.adminStatus,e.target.value);return}updateFieldColour(e.target)});document.addEventListener('focusin',e=>{if(e.target.id==='wizLdm')e.target.value=normalizedLdm(e.target.value);},true);document.addEventListener('focusout',e=>{if(e.target.matches('[data-point-field="country"]')){const code=normalizeCountryCode(e.target.value);if(code)e.target.value=code;}if(e.target.id==='wizLdm')e.target.value=ldmDisplay(e.target.value);},true);
document.addEventListener('submit',e=>{if(e.target.id==='accessLoginForm'){e.preventDefault();loginWithCode();return}if(e.target.id==='settingsForm'){e.preventDefault();state.notifyEmail=$('#notifyEmail').value.trim();state.currency=$('#defaultCurrency').value||'PLN';state.notifyBrowser=Boolean($('#notifyBrowser')?.checked);store();render();toast('Ustawienia zapisane.')}});
await load();render();
})();

