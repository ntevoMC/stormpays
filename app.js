const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ROOT="spv2_";
const KEYS={
  session:ROOT+"session", theme:ROOT+"theme"
};

const freshData=()=>({
  cards:[],
  salesReceiving:false,
  spentUsdt:0,
  dailyRate:null,
  dailyRateDate:null,
  sales:[],
  buy:[],
  deposits:[],
  messages:[],
  notifications:[],
  disputes:[]
});

function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
function userKey(id){return ROOT+"data_"+id}
function now(){
  const d=new Date();
  return d.toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function uid(prefix){return prefix+"-"+Math.floor(10000+Math.random()*89999)}
function init(){
  const users=getUsers();
  users.forEach(u=>{
    if(localStorage.getItem(userKey(u.id))===null) write(userKey(u.id),freshData());
  });
}
function getUsers(){
  const base=Array.isArray(window.STROMPAYS_USERS)?window.STROMPAYS_USERS:[];
  const sessionUsers=read(ROOT+"session_users",[]);
  const merged=[...base];
  sessionUsers.forEach(u=>{
    const i=merged.findIndex(x=>x.id===u.id);
    if(i>=0) merged[i]=u; else merged.push(u);
  });
  return merged;
}
function saveUsers(v){
  const baseIds=new Set((Array.isArray(window.STROMPAYS_USERS)?window.STROMPAYS_USERS:[]).map(x=>x.id));
  const extra=v.filter(x=>!baseIds.has(x.id));
  write(ROOT+"session_users",extra);
}
function session(){return read(KEYS.session,null)}
function setSession(v){write(KEYS.session,v)}
function currentUser(){
  const s=session(); if(!s)return null;
  return getUsers().find(u=>u.id===s.userId)||null;
}
function actingUser(){
  const s=session(); if(!s)return null;
  const id=s.impersonating||s.userId;
  return getUsers().find(u=>u.id===id)||null;
}
function data(){
  const u=actingUser(); if(!u)return freshData();
  if(localStorage.getItem(userKey(u.id))===null) write(userKey(u.id),freshData());
  return read(userKey(u.id),freshData());
}
function saveData(d){const u=actingUser(); if(u)write(userKey(u.id),d)}
function dataForUser(userId){
  if(localStorage.getItem(userKey(userId))===null) write(userKey(userId),freshData());
  return read(userKey(userId),freshData());
}
function saveDataForUser(userId,d){write(userKey(userId),d)}
function accountBalance(userId=null){
  const id=userId||actingUser()?.id;
  const u=getUsers().find(x=>x.id===id);
  const d=id?dataForUser(id):freshData();
  const base=Number(u?.balance??0);
  const spent=Number(d?.spentUsdt??0);
  return Math.max(0, base-spent);
}
function localDateKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function getDailyRate(userId=null){
  const id=userId||actingUser()?.id;
  if(!id)return 43.93;

  const d=dataForUser(id);
  const today=localDateKey();

  if(d.dailyRateDate!==today || !Number(d.dailyRate)){
    // One rate for the whole calendar day.
    // Range kept close to the reference UI.
    d.dailyRate=Number((43.50+Math.random()*0.80).toFixed(2));
    d.dailyRateDate=today;
    saveDataForUser(id,d);
  }

  return Number(d.dailyRate);
}

function orderUsdt(order){
  const rate=Number(order?.myRate||order?.rate||0);
  const amount=Number(order?.amount||0);
  if(rate<=0)return 0;
  return amount/rate;
}
function uah(n){return Number(n||0).toLocaleString("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2})+" UAH"}
function usdt(n){return Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" USDT"}
function status(s){const m={active:["active","Активен"],blocked:["blocked","Заблокирован"],done:["done","Завершено"],new:["new","Новая"],checking:["checking","Проверка"],pending:["pending","Ожидает"],dispute:["dispute","Спор"],cancelled:["cancelled","Отменено"]};let x=m[s]||["pending",s];return `<span class="status ${x[0]}">${x[1]}</span>`}
function toast(a,b=""){const e=document.createElement("div");e.className="toast";e.innerHTML=`<b>${a}</b><span>${b}</span>`;$("#toastRoot").append(e);setTimeout(()=>e.remove(),3000)}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
function initials(name){return (name||"SP").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function isAdmin(){return currentUser()?.role==="admin"}
function isImpersonating(){return !!session()?.impersonating}

function showLogin(){
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}
function showApp(){
  const u=currentUser();
  if(!u){showLogin();return}
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  applyIdentity();
  renderAll();
}
function applyIdentity(){
  const owner=actingUser(), auth=currentUser();
  const name=owner?.name||"—", email=owner?.email||"—";

  $("#headerAvatar").textContent=initials(owner?.name);
  $("#dropdownAvatar").textContent=initials(owner?.name);
  $("#headerName").textContent=name;
  $("#headerEmail").textContent=email;
  $("#dropdownName").textContent=name;
  $("#dropdownEmail").textContent=email;
  $("#welcomeName").textContent=name.split(" ")[0]||"пользователь";

  $$(".admin-only").forEach(x=>x.classList.toggle("hidden",!isAdmin()||isImpersonating()));
  $("#returnAdminBtn").classList.toggle("hidden",!isImpersonating());
}
function go(page){
  if(page==="users" && (!isAdmin()||isImpersonating())) return;
  $$(".page").forEach(x=>x.classList.add("hidden"));
  const el=$(`#${page}Page`); if(!el)return;
  el.classList.remove("hidden");
  $$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const names={home:"Главная",cards:"Карты и кошельки",settings:"Настройки",analytics:"Аналитика",sales:"Продажи",buy:"Купля",balance:"Баланс",messages:"История переписки",disputes:"Диспуты",users:"Пользователи"};
  $("#pageTitle").textContent=names[page]; $("#crumb").textContent=names[page].toUpperCase();
  $("#sidebar").classList.remove("open");
}

function accountSettings(){
  const u=actingUser();
  const s=u?.settings||{};
  return {
    incomingCurrency:s.incomingCurrency||"UAH",
    outgoingCurrency:s.outgoingCurrency||"UAH",
    commissionIn:Number(s.commissionIn??5),
    commissionOut:Number(s.commissionOut??2)
  };
}

function parseOrderDate(value){
  if(!value) return null;

  // Supports:
  // 11.09.2026, 08:42
  // 11.09.2026 08:42
  // 2026-09-11 08:42
  // ISO strings
  const raw=String(value).trim();

  let m=raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:,|\s)+\s*(\d{2}):(\d{2})(?::(\d{2}))?/);
  if(m){
    return new Date(
      Number(m[3]),
      Number(m[2])-1,
      Number(m[1]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]||0)
    );
  }

  m=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(m){
    return new Date(
      Number(m[1]),
      Number(m[2])-1,
      Number(m[3]),
      Number(m[4]||0),
      Number(m[5]||0),
      Number(m[6]||0)
    );
  }

  const d=new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKeyFromDate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function shortDayLabel(d){
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
}

function profitSeries30Days(){
  const d=data();
  const s=accountSettings();

  const today=new Date();
  today.setHours(0,0,0,0);

  const days=[];
  const map={};

  for(let i=29;i>=0;i--){
    const date=new Date(today);
    date.setDate(today.getDate()-i);
    const key=dayKeyFromDate(date);
    const row={key,date,label:shortDayLabel(date),profit:0,payin:0,payout:0};
    days.push(row);
    map[key]=row;
  }

  const addOrder=(order,type)=>{
    if(order.status!=="done") return;
    const dt=parseOrderDate(order.date);
    if(!dt) return;
    dt.setHours(0,0,0,0);
    const key=dayKeyFromDate(dt);
    const row=map[key];
    if(!row) return;

    const amount=Number(order.amount||0);
    if(type==="sales"){
      row.payin+=amount;
      row.profit+=amount*(Number(s.commissionIn)||0)/100;
    }else{
      row.payout+=amount;
      row.profit+=amount*(Number(s.commissionOut)||0)/100;
    }
  };

  d.sales.forEach(x=>addOrder(x,"sales"));
  d.buy.forEach(x=>addOrder(x,"buy"));

  return days;
}

function renderProfitChart(){
  const el=$("#profitChart");
  if(!el) return;

  const series=profitSeries30Days();
  const values=series.map(x=>x.profit);
  const total=values.reduce((a,b)=>a+b,0);
  const max=Math.max(...values,0);

  if($("#profit30Total")) $("#profit30Total").textContent=uah(total);

  // Honest zero-state.
  if(max<=0){
    el.innerHTML=`
      <div class="chart-y-axis">
        <span>0</span>
      </div>
      <svg class="profit-svg" viewBox="0 0 1000 260" preserveAspectRatio="none" aria-label="Прибыль за 30 дней">
        <line x1="0" y1="235" x2="1000" y2="235" class="chart-zero-line"/>
      </svg>
      <div class="chart-x-labels">
        <span>${series[0].label}</span>
        <span>${series[9].label}</span>
        <span>${series[19].label}</span>
        <span>${series[29].label}</span>
      </div>
      <div class="chart-empty-note">За последние 30 дней завершённых операций нет</div>`;
    return;
  }

  const top=max*1.12;
  const left=14, right=986, topY=18, bottomY=230;
  const width=right-left, height=bottomY-topY;

  const points=series.map((row,i)=>{
    const x=left+(i/(series.length-1))*width;
    const y=bottomY-(row.profit/top)*height;
    return {x,y,row};
  });

  const poly=points.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area=`${left},${bottomY} ${poly} ${right},${bottomY}`;

  const y1=top;
  const y2=top*.75;
  const y3=top*.5;
  const y4=top*.25;

  const formatAxis=n=>{
    if(n>=1000000) return (n/1000000).toFixed(1)+"M";
    if(n>=1000) return (n/1000).toFixed(n>=10000?0:1)+"k";
    return n.toFixed(n>=100?0:2);
  };

  const circles=points
    .filter((p,i)=>p.row.profit>0 || i===series.length-1)
    .map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3.4" class="chart-point">
      <title>${p.row.label}: ${uah(p.row.profit)}</title>
    </circle>`).join("");

  el.innerHTML=`
    <div class="chart-y-axis">
      <span>${formatAxis(y1)}</span>
      <span>${formatAxis(y2)}</span>
      <span>${formatAxis(y3)}</span>
      <span>${formatAxis(y4)}</span>
      <span>0</span>
    </div>
    <svg class="profit-svg" viewBox="0 0 1000 260" preserveAspectRatio="none" aria-label="Прибыль за 30 дней">
      <defs>
        <linearGradient id="profitAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7a6cff" stop-opacity=".34"/>
          <stop offset="100%" stop-color="#7a6cff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${left}" y1="${bottomY}" x2="${right}" y2="${bottomY}" class="chart-grid-line"/>
      <line x1="${left}" y1="${topY+height*.25}" x2="${right}" y2="${topY+height*.25}" class="chart-grid-line"/>
      <line x1="${left}" y1="${topY+height*.5}" x2="${right}" y2="${topY+height*.5}" class="chart-grid-line"/>
      <line x1="${left}" y1="${topY+height*.75}" x2="${right}" y2="${topY+height*.75}" class="chart-grid-line"/>
      <polygon points="${area}" fill="url(#profitAreaGradient)"/>
      <polyline points="${poly}" class="chart-profit-line"/>
      ${circles}
    </svg>
    <div class="chart-x-labels">
      <span>${series[0].label}</span>
      <span>${series[9].label}</span>
      <span>${series[19].label}</span>
      <span>${series[29].label}</span>
    </div>`;
}


function normalizeAccountData(d){
  if(!Array.isArray(d.notifications)) d.notifications=[];
  if(!Array.isArray(d.messages)) d.messages=[];
  return d;
}

function pushNotification(title,text,type="info",userId=null){
  const id=userId||actingUser()?.id;
  if(!id)return;

  const d=normalizeAccountData(dataForUser(id));
  d.notifications.unshift({
    id:uid("NTF"),
    title,
    text,
    type,
    date:now(),
    read:false
  });

  d.notifications=d.notifications.slice(0,80);

  // History of correspondence must always remain empty.
  d.messages=[];

  saveDataForUser(id,d);

  if(actingUser()?.id===id){
    renderNotifications();
    renderMessages();
  }
}

function renderNotifications(){
  const d=normalizeAccountData(data());
  const arr=d.notifications;
  const unread=arr.filter(x=>!x.read).length;

  if($("#notificationsBadge")){
    $("#notificationsBadge").textContent=unread>99?"99+":String(unread);
    $("#notificationsBadge").classList.toggle("hidden",unread===0);
  }

  if($("#notificationsSubtitle")){
    $("#notificationsSubtitle").textContent=unread
      ? `${unread} непрочитанных`
      : "Нет новых уведомлений";
  }

  if($("#statusMessages")){
    $("#statusMessages").textContent=arr.length;
  }

  if(!$("#notificationsList"))return;

  $("#notificationsList").innerHTML=arr.length
    ? arr.map(n=>`
      <button class="notification-item ${n.read?"":"unread"}" data-id="${n.id}" type="button">
        <span class="notification-dot ${n.type||"info"}"></span>
        <span class="notification-copy">
          <b>${n.title}</b>
          <span>${n.text}</span>
          <small>${n.date}</small>
        </span>
      </button>
    `).join("")
    : `<div class="notifications-empty">
         <span class="notifications-empty-bell">○</span>
         <b>Пока пусто</b>
         <span>Новые заявки и изменения статусов появятся здесь.</span>
       </div>`;

  $$(".notification-item").forEach(item=>{
    item.onclick=()=>{
      const latest=normalizeAccountData(data());
      const n=latest.notifications.find(x=>x.id===item.dataset.id);
      if(n && !n.read){
        n.read=true;
        saveData(latest);
        renderNotifications();
      }
    };
  });
}

function markAllNotificationsRead(){
  const d=normalizeAccountData(data());
  d.notifications.forEach(n=>n.read=true);
  saveData(d);
  renderNotifications();
}

function ensureMessagesStayEmpty(){
  const d=normalizeAccountData(data());
  if(d.messages.length){
    d.messages=[];
    saveData(d);
  }
}

let notificationsOpen=false;

function openNotifications(){
  notificationsOpen=true;
  $("#notificationsMenu")?.classList.add("open");
  $("#notificationsTrigger")?.setAttribute("aria-expanded","true");
}

function closeNotifications(){
  notificationsOpen=false;
  $("#notificationsMenu")?.classList.remove("open");
  $("#notificationsTrigger")?.setAttribute("aria-expanded","false");
}

function toggleNotifications(){
  if(notificationsOpen) closeNotifications();
  else {
    closeAccountMenu();
    openNotifications();
  }
}

function calculations(){
  const d=data(), s=accountSettings();
  const doneSales=d.sales.filter(x=>x.status==="done");
  const doneBuy=d.buy.filter(x=>x.status==="done");
  const pin=doneSales.reduce((a,b)=>a+b.amount,0);
  const pout=doneBuy.reduce((a,b)=>a+b.amount,0);
  const profit=pin*(Number(s.commissionIn)||0)/100+pout*(Number(s.commissionOut)||0)/100;
  return {pin,pout,profit,done:doneSales.length+doneBuy.length};
}
function renderHome(){
  const d=data(), c=calculations(), balance=accountBalance();
  $("#headerBalance").textContent=usdt(balance); $("#homeBalance").textContent=usdt(balance); $("#balancePageValue").textContent=usdt(balance);
  if($("#balanceAccessState")){
    const ok=balance>=10;
    $("#balanceAccessState").textContent=ok?"Доступ открыт":"Заблокировано";
    $("#balanceAccessState").className=ok?"access-open":"access-locked";
  }
  $("#profitToday").textContent=uah(c.profit); $("#payInToday").textContent=uah(c.pin); $("#payOutToday").textContent=uah(c.pout);
  $("#statusCards").textContent=d.cards.filter(x=>x.active).length;
  $("#statusOrders").textContent=d.sales.concat(d.buy).filter(x=>["new","checking"].includes(x.status)).length;
  $("#statusDisputes").textContent=d.sales.concat(d.buy).filter(x=>x.status==="dispute").length;
  /* notification count is rendered by renderNotifications() */
  if($("#statusDailyRate")) $("#statusDailyRate").textContent=getDailyRate().toFixed(2);
  renderProfitChart();
}
function renderCards(){
  const d=data(), arr=d.cards;
  $("#cardsCount").textContent=arr.length;
  $("#activeCardsCount").textContent=arr.filter(x=>x.active).length;
  $("#cardsMileage").textContent=uah(arr.reduce((a,b)=>a+(b.mileage||0),0));

  $("#cardsBody").innerHTML=arr.length?arr.map(c=>`<tr>
    <td><strong>${c.bank}</strong></td>
    <td>${c.owner}</td>
    <td>${c.card}</td>
    <td>${c.phone||"—"}</td>
    <td>${uah(c.mileage||0)}</td>
    <td>
      <button
        class="card-toggle ${c.active?"is-on":""}"
        data-id="${c.id}"
        data-active="${c.active?"1":"0"}"
        type="button"
        role="switch"
        aria-checked="${c.active?"true":"false"}"
        title="${c.active?"Отключить карту":"Включить карту"}"
      >
        <span class="card-toggle-knob"></span>
      </button>
    </td>
    <td>
      <div class="card-actions">
        <button class="action-edit edit-card" data-id="${c.id}">Редактировать</button>
        <button class="action-delete delete-card" data-id="${c.id}">Удалить</button>
      </div>
    </td>
  </tr>`).join(""):`<tr><td colspan="7">Реквизиты пока не добавлены.</td></tr>`;

  $$(".edit-card").forEach(b=>b.onclick=()=>openCardModal(b.dataset.id));
  $$(".delete-card").forEach(b=>b.onclick=()=>deleteCard(b.dataset.id));
  $$(".card-toggle").forEach(t=>t.onclick=()=>{
    const enabled=t.dataset.active!=="1";
    toggleCard(t.dataset.id,enabled);
  });
}
function toggleCard(id,enabled){
  const d=data(), c=d.cards.find(x=>String(x.id)===String(id));
  if(!c)return;
  c.active=!!enabled;
  saveData(d);
  if(!d.cards.some(x=>x.active) && d.salesReceiving){
    d.salesReceiving=false;
    saveData(d);
    clearSalesTimer();
    toast("Приём заявок остановлен","Нет активных карт");
  }else{
    toast(enabled?"Карта активирована":"Карта отключена",c.bank);
  }
  renderAll();
}
function deleteCard(id){
  const d=data(), c=d.cards.find(x=>String(x.id)===String(id));
  if(!c)return;
  openModal(`<h3>Удалить карту?</h3><div class="sub">${c.bank} · ${c.card}</div>
    <p class="modal-warning">Реквизиты будут удалены из этого кабинета.</p>
    <div class="modal-actions">
      <button class="btn secondary" id="deleteCardCancel">Отмена</button>
      <button class="btn danger" id="deleteCardConfirm">Удалить</button>
    </div>`);
  $("#deleteCardCancel").onclick=closeModal;
  $("#deleteCardConfirm").onclick=()=>{
    d.cards=d.cards.filter(x=>String(x.id)!==String(id));
    if(!d.cards.some(x=>x.active)) d.salesReceiving=false;
    saveData(d); clearSalesTimer(); closeModal(); renderAll();
    toast("Карта удалена",c.bank);
  };
}
function openCardModal(id=null){
  const d=data(), c=id?d.cards.find(x=>String(x.id)===String(id)):null;
  const v=c||{system:"",owner:"",bank:"Monobank",card:"",expiry:"",iban:"",phone:"",currency:"UAH",dayLimit:0,min:0,max:0,maxPayments:0,mileage:0,active:false};
  openModal(`<h3>${c?"Редактировать реквизиты":"Добавить реквизиты"}</h3><div class="sub"></div>
    <form id="cardForm" class="modal-form">
      <label><span>Название в системе</span><input id="cfSystem" value="${v.system}" required></label>
      <label><span>Имя владельца</span><input id="cfOwner" value="${v.owner}" required></label>
      <label><span>Банк</span><select id="cfBank"><option>Monobank</option><option>PrivatBank</option><option>A-Bank</option><option>Sense Bank</option><option>PUMB</option><option>Raiffeisen</option></select></label>
      <div class="form-2"><label><span>Номер карты</span><input id="cfCard" value="${v.card}" placeholder="0000 0000 0000 0000" required></label><label><span>Срок</span><input id="cfExpiry" value="${v.expiry}" placeholder="MM/YY"></label></div>
      <label><span>IBAN</span><input id="cfIban" value="${v.iban}"></label>
      <label><span>Телефон</span><input id="cfPhone" value="${v.phone}" placeholder="+380..."></label>
      <div class="form-3"><label><span>Лимит / день</span><input id="cfLimit" type="number" value="${v.dayLimit}"></label><label><span>MIN</span><input id="cfMin" type="number" value="${v.min}"></label><label><span>MAX</span><input id="cfMax" type="number" value="${v.max}"></label></div>
      <label><span>MAX платежей</span><input id="cfPayments" type="number" value="${v.maxPayments}"></label>
      <div class="modal-actions"><button type="button" class="btn secondary" id="cardCancel">Отмена</button><button class="btn primary">Сохранить</button></div>
    </form>`);
  $("#cfBank").value=v.bank; $("#cardCancel").onclick=closeModal;
  $("#cardForm").onsubmit=e=>{
    e.preventDefault();
    const obj={id:c?.id||Date.now(),system:$("#cfSystem").value.trim(),owner:$("#cfOwner").value.trim(),bank:$("#cfBank").value,card:$("#cfCard").value.trim(),expiry:$("#cfExpiry").value.trim(),iban:$("#cfIban").value.trim(),phone:$("#cfPhone").value.trim(),currency:"UAH",dayLimit:+$("#cfLimit").value||0,min:+$("#cfMin").value||0,max:+$("#cfMax").value||0,maxPayments:+$("#cfPayments").value||0,mileage:c?.mileage||0,active:c?.active??false};
    if(c)d.cards[d.cards.findIndex(x=>x.id===c.id)]=obj; else d.cards.push(obj);
    saveData(d); closeModal(); renderAll(); toast("Реквизиты сохранены",obj.bank);
  }
}
function renderSettings(){
  const s=accountSettings();
  $("#incomingCurrencyView").textContent=s.incomingCurrency;
  $("#outgoingCurrencyView").textContent=s.outgoingCurrency;
  $("#commissionInView").textContent=s.commissionIn.toLocaleString("ru-RU",{maximumFractionDigits:2})+"%";
  $("#commissionOutView").textContent=s.commissionOut.toLocaleString("ru-RU",{maximumFractionDigits:2})+"%";
}

let salesTimer=null;
let salesTimerUserId=null;

function clearSalesTimer(){
  if(salesTimer){clearTimeout(salesTimer);salesTimer=null;}
  salesTimerUserId=null;
}
function activeCardsForUser(userId){
  return dataForUser(userId).cards.filter(x=>x.active);
}
function canReceiveSales(userId){
  const d=dataForUser(userId);
  return accountBalance(userId)>=10 && d.salesReceiving && d.cards.some(x=>x.active);
}
function setSalesReceiving(enabled){
  const u=actingUser();
  if(!u)return;
  const d=data();

  if(!enabled){
    d.salesReceiving=false;
    saveData(d);
    clearSalesTimer();
    renderSalesReceiverState();
    toast("Приём заявок остановлен");
    return;
  }

  if(accountBalance()<10){
    d.salesReceiving=false;
    saveData(d);
    if($("#salesReceiving")) $("#salesReceiving").checked=false;
    clearSalesTimer();
    renderSalesReceiverState();
    toast("Недостаточный баланс","Для приёма заявок требуется минимум 10 USDT");
    return;
  }

  if(!d.cards.some(x=>x.active)){
    d.salesReceiving=false;
    saveData(d);
    if($("#salesReceiving")) $("#salesReceiving").checked=false;
    clearSalesTimer();
    renderSalesReceiverState();
    toast("Нет активной карты","Активируйте хотя бы одни реквизиты");
    return;
  }

  d.salesReceiving=true;
  saveData(d);
  renderSalesReceiverState();
  scheduleNextSale(u.id);
  toast("Приём заявок включён","Новая заявка придёт через случайные 10–60 секунд");
}
function renderSalesReceiverState(){
  const d=data(), balance=accountBalance(), active=d.cards.filter(x=>x.active).length;
  if($("#salesReceiving")) $("#salesReceiving").checked=!!d.salesReceiving;

  if(!$("#salesReceiverHint")) return;
  if(d.salesReceiving && balance>=10 && active>0){
    $("#salesReceiverHint").innerHTML=`<i class="receiver-dot"></i> Приём активен · ${usdt(balance)} · курс ${getDailyRate().toFixed(2)} · 10–60 сек.`;
    $("#salesReceiverHint").classList.add("on");
  }else if(balance<10){
    $("#salesReceiverHint").textContent="Требуется баланс от 10 USDT";
    $("#salesReceiverHint").classList.remove("on");
  }else if(active===0){
    $("#salesReceiverHint").textContent="Активируйте карту для приёма платежей";
    $("#salesReceiverHint").classList.remove("on");
  }else{
    $("#salesReceiverHint").textContent="Приём заявок выключен";
    $("#salesReceiverHint").classList.remove("on");
  }
}
function scheduleNextSale(userId){
  clearSalesTimer();
  if(!canReceiveSales(userId)) return;
  const delay=10000+Math.floor(Math.random()*50001);
  salesTimerUserId=userId;
  salesTimer=setTimeout(()=>{
    if(!canReceiveSales(userId)) { clearSalesTimer(); return; }
    generateIncomingSale(userId);
    if(canReceiveSales(userId)) scheduleNextSale(userId);
  },delay);
}
function generateIncomingSale(userId){
  const d=dataForUser(userId);
  const cards=d.cards.filter(x=>x.active);
  const available=accountBalance(userId);
  if(!cards.length || available<10 || !d.salesReceiving)return;

  const card=cards[Math.floor(Math.random()*cards.length)];
  const rate=getDailyRate(userId);
  const myRate=rate;

  // Maximum order in UAH can never exceed the current USDT balance.
  const balanceCapUah=available*myRate;
  let min=Math.max(50,Number(card.min)||50);
  let max=Number(card.max)||balanceCapUah;
  max=Math.min(max,balanceCapUah);

  // If the configured MIN is larger than the available balance equivalent,
  // use the available balance as the upper and lower practical cap.
  if(max<50)return;
  if(min>max)min=Math.min(50,max);

  const raw=min+Math.random()*Math.max(0,max-min);
  let amount=Math.round(raw/10)*10;
  amount=Math.max(10,Math.min(amount,Math.floor(balanceCapUah*100)/100));

  const order={
    id:String(Math.floor(100+Math.random()*899900)),
    date:now(),
    status:"new",
    amount,
    currency:"UAH",
    rate,
    myRate,
    usdtAmount:amount/myRate,
    bank:`${card.bank} / ${card.system||"карта"}`,
    cardId:card.id
  };
  d.sales.unshift(order);
  saveDataForUser(userId,d);

  pushNotification(
    "Новая заявка",
    `${order.id} · ${uah(order.amount)} · ${usdt(order.usdtAmount)}`,
    "new",
    userId
  );

  if(actingUser()?.id===userId){
    renderTrades("sales");
    renderHome();
    toast("Новая заявка",`${order.id} · ${uah(order.amount)} ≈ ${usdt(order.usdtAmount)}`);
  }
}
function confirmSale(id){
  const userId=actingUser()?.id;
  if(!userId)return;

  const d=dataForUser(userId), order=d.sales.find(x=>x.id===id);
  if(!order || order.status!=="new")return;

  const required=Number(order.usdtAmount||orderUsdt(order));
  const available=accountBalance(userId);

  if(required<=0){
    toast("Ошибка заявки","Не удалось рассчитать сумму в USDT");
    return;
  }

  if(required>available+0.0000001){
    toast("Недостаточно USDT",`Нужно ${usdt(required)}, доступно ${usdt(available)}`);
    return;
  }

  // Deduct immediately when the user confirms the order.
  d.spentUsdt=(Number(d.spentUsdt)||0)+required;
  order.usdtAmount=required;
  order.status="checking";

  // If balance fell below 10 USDT, receiving automatically stops.
  const remaining=Math.max(0,available-required);
  if(remaining<10){
    d.salesReceiving=false;
    clearSalesTimer();
  }

  d.messages=[];
  saveDataForUser(userId,d);

  pushNotification(
    "Платёж подтверждён",
    `${order.id} · списано ${usdt(required)} · остаток ${usdt(remaining)}`,
    "checking",
    userId
  );

  closeModal();
  renderAll();

  toast(
    "Платёж подтверждён",
    `Списано ${usdt(required)} · Остаток ${usdt(remaining)}`
  );

  if(remaining<10){
    pushNotification(
      "Приём заявок остановлен",
      `Баланс ${usdt(remaining)} — меньше минимальных 10 USDT`,
      "warning",
      userId
    );
    setTimeout(()=>toast("Приём заявок остановлен","Баланс стал меньше 10 USDT"),250);
  }

  const delay=1800+Math.floor(Math.random()*2200);
  setTimeout(()=>{
    const latest=dataForUser(userId), x=latest.sales.find(v=>v.id===id);
    if(!x || x.status!=="checking")return;

    x.status="done";
    const card=latest.cards.find(c=>String(c.id)===String(x.cardId));
    if(card)card.mileage=(Number(card.mileage)||0)+Number(x.amount||0);


    latest.messages=[];
    saveDataForUser(userId,latest);

    pushNotification(
      "Заявка завершена",
      `${x.id} · ${uah(x.amount)} успешно обработано`,
      "success",
      userId
    );

    if(actingUser()?.id===userId){
      renderAll();
      toast("Заявка завершена",`${x.id} · ${uah(x.amount)}`);
    }
  },delay);
}

let tradeFilters={sales:"",buy:""};
function renderTrades(type){
  const d=data(), arr=d[type], f=tradeFilters[type];
  const buyActiveOnly=type==="buy" && $("#buyOnlyActive")?.checked;
  let rows=arr.filter(x=>(!f||x.status===f)&&(!buyActiveOnly||["new","checking"].includes(x.status)));

  const body=$(type==="sales"?"#salesBody":"#buyBody");
  body.innerHTML=rows.length?rows.map(x=>{
    const action=(type==="sales" && x.status==="new")
      ? `<div class="confirm-wrap"><small>${usdt(Number(x.usdtAmount||orderUsdt(x)))}</small><button class="confirm-payment" data-id="${x.id}">Подтвердить платёж</button></div>`
      : `<button class="link-btn open-trade" data-type="${type}" data-id="${x.id}">Открыть</button>`;
    return `<tr>
      <td><strong>${x.id}</strong></td>
      <td>${x.date}</td>
      <td>${status(x.status)}</td>
      <td>${uah(x.amount)}</td>
      <td>${x.currency}</td>
      <td>${Number(x.rate).toFixed(2)} / ${Number(x.myRate).toFixed(2)}</td>
      <td>${x.bank}</td>
      <td>${action}</td>
    </tr>`;
  }).join(""):`<tr><td colspan="8">Заявок пока нет.</td></tr>`;

  $$(".open-trade").forEach(b=>b.onclick=()=>openTradeModal(b.dataset.type,b.dataset.id));
  $$(".confirm-payment").forEach(b=>b.onclick=()=>confirmSale(b.dataset.id));
}
function openTradeModal(type,id){
  const d=data(), x=d[type].find(v=>v.id===id);
  if(!x)return;
  const confirm=(type==="sales" && x.status==="new")
    ? `<button type="button" class="btn primary" id="modalConfirmSale">Подтвердить платёж</button>`
    : "";
  openModal(`<h3>${x.id}</h3><div class="sub">${type==="sales"?"PayIn":"PayOut"}</div>
    <div class="readonly-settings">
      <article class="readonly-setting"><span>Сумма</span><strong>${uah(x.amount)} <small class="usdt-equivalent">≈ ${usdt(Number(x.usdtAmount||orderUsdt(x)))}</small></strong></article>
      <article class="readonly-setting"><span>Статус</span><strong>${status(x.status)}</strong></article>
      <article class="readonly-setting"><span>Курс / мой курс</span><strong>${Number(x.rate).toFixed(2)} / ${Number(x.myRate).toFixed(2)}</strong></article>
      <article class="readonly-setting"><span>Банк / реквизит</span><strong>${x.bank}</strong></article>
    </div>
    <div class="modal-actions">${confirm}<button type="button" class="btn secondary" id="tradeClose">Закрыть</button></div>`);
  $("#tradeClose").onclick=closeModal;
  if($("#modalConfirmSale"))$("#modalConfirmSale").onclick=()=>confirmSale(id);
}
function renderDeposits(){
  const d=data(); $("#depositsBody").innerHTML=d.deposits.length?d.deposits.map(x=>`<tr><td><strong>${x.id}</strong></td><td>${x.date}</td><td>${x.network}</td><td>${usdt(x.amount)}</td><td>${usdt(x.fee||0)}</td><td>${status(x.status)}</td></tr>`).join(""):`<tr><td colspan="6">Запросов на пополнение нет.</td></tr>`;
}
function depositModal(){
  openModal(`<h3>Пополнение USDT</h3><div class="sub"></div>
    <form id="depositForm" class="modal-form">
      <label><span>Сумма USDT</span><input id="depositAmount" type="number" min="1" step=".01" value="0" required></label>
      <label><span>Сеть</span><select id="depositNetwork"><option>TRC20</option></select></label>
      <div class="modal-actions"><button type="button" class="btn secondary" id="depositCancel">Отмена</button><button class="btn primary">Создать запрос</button></div>
    </form>`);
  $("#depositCancel").onclick=closeModal;
  $("#depositForm").onsubmit=e=>{
    e.preventDefault();
    const d=data(), amount=+$("#depositAmount").value||0;
    if(amount<=0)return;
    const dep={id:uid("DEP"),date:now(),network:"TRC20",amount,fee:0,status:"pending"};
    d.deposits.unshift(dep);
    d.messages=[];
    saveData(d);
    pushNotification("Запрос на пополнение",`${dep.id} · ${usdt(amount)} · TRC20`,"info");
    closeModal();
    renderAll();
    toast("Запрос создан",dep.id);
  }
}
function renderMessages(){
  ensureMessagesStayEmpty();
}
function renderAnalytics(){
  $("#anPayIn").textContent="0.00 UAH"; $("#anPayOut").textContent="0.00 UAH"; $("#anProfit").textContent="0.00 UAH"; $("#anDone").textContent="0";
}
function calculateAnalytics(){
  const c=calculations(); $("#anPayIn").textContent=uah(c.pin); $("#anPayOut").textContent=uah(c.pout); $("#anProfit").textContent=uah(c.profit); $("#anDone").textContent=c.done; toast("Отчёт рассчитан");
}
function renderUsers(){
  if(!isAdmin())return;
  const users=getUsers().filter(x=>x.role!=="admin");
  $("#adminUsersCount").textContent=users.length; $("#adminActiveCount").textContent=users.filter(x=>x.active).length; $("#adminBlockedCount").textContent=users.filter(x=>!x.active).length;
  $("#usersBody").innerHTML=users.length?users.map(u=>`<tr>
    <td><strong>${u.name}</strong></td><td>${u.email}</td><td>${status(u.active?"active":"blocked")}</td><td>${u.created}</td><td>${u.lastLogin||"—"}</td>
    <td><button class="link-btn user-open" data-id="${u.id}">Кабинет</button> · <button class="link-btn user-edit" data-id="${u.id}">Изменить</button></td>
  </tr>`).join(""):`<tr><td colspan="6">Пользователей пока нет.</td></tr>`;
  $$(".user-open").forEach(b=>b.onclick=()=>impersonate(b.dataset.id));
  $$(".user-edit").forEach(b=>b.onclick=()=>userModal(b.dataset.id));
}
function userModal(id=null){
  if(!isAdmin())return;
  const users=getUsers(), u=id?users.find(x=>x.id===id):null, v=u||{name:"",email:"",password:"",active:true,balance:0};
  openModal(`<h3>${u?"Просмотр пользователя":"Новый пользователь"}</h3><div class="sub">${u?"Пользователи из users.js редактируются в самом файле.":"Сформируйте готовую запись для users.js."}</div>
    <form id="userForm" class="modal-form">
      <label><span>Имя</span><input id="ufName" value="${v.name}" required ${u?"disabled":""}></label>
      <label><span>Email</span><input id="ufEmail" type="email" value="${v.email}" required ${u?"disabled":""}></label>
      <label><span>Пароль</span><input id="ufPassword" type="text" value="${u?v.password:""}" required ${u?"disabled":""}></label>
      <label><span>Баланс USDT</span><input id="ufBalance" type="number" min="0" step=".01" value="${Number(v.balance||0)}" ${u?"disabled":""}></label>
      <label class="checkbox"><input id="ufActive" type="checkbox" ${v.active?"checked":""} ${u?"disabled":""}> Разрешить вход</label>
      ${u ? `
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="userCancel">Закрыть</button>
        </div>` : `
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="userCancel">Отмена</button>
          <button class="btn primary">Сформировать код</button>
        </div>`}
    </form>
    <div id="generatedUserBlock"></div>`);
  $("#userCancel").onclick=closeModal;
  if(!u){
    $("#userForm").onsubmit=e=>{
      e.preventDefault();
      const id="usr_"+Date.now();
      const obj={
        id,
        name:$("#ufName").value.trim(),
        email:$("#ufEmail").value.trim().toLowerCase(),
        password:$("#ufPassword").value,
        role:"user",
        active:$("#ufActive").checked,
        created:new Date().toLocaleDateString("ru-RU"),
        lastLogin:"—",
        balance:+$("#ufBalance").value||0,
        settings:{
          incomingCurrency:"UAH",
          outgoingCurrency:"UAH",
          commissionIn:5,
          commissionOut:2
        }
      };
      const code=JSON.stringify(obj,null,2);
      $("#generatedUserBlock").innerHTML=`
        <div style="margin-top:14px">
          <div class="sub">Добавьте этот объект внутрь массива в <b>users.js</b>:</div>
          <textarea id="generatedUserCode" style="width:100%;min-height:250px;background:var(--bg2);color:var(--text);border:1px solid var(--line);border-radius:11px;padding:12px">${code}</textarea>
          <div class="modal-actions">
            <button type="button" class="btn secondary" id="copyUserCode">Скопировать</button>
            <button type="button" class="btn primary" id="downloadUsersFile">Скачать обновлённый users.js</button>
          </div>
        </div>`;
      $("#copyUserCode").onclick=async()=>{
        try{await navigator.clipboard.writeText(code);toast("Код скопирован")}catch{toast("Скопируйте код вручную")}
      };
      $("#downloadUsersFile").onclick=()=>{
        const current=getUsers().filter(x=>!x.__sessionOnly);
        const exists=current.some(x=>x.email.toLowerCase()===obj.email.toLowerCase());
        if(!exists) current.push(obj);
        const js='window.STROMPAYS_USERS = '+JSON.stringify(current,null,2)+';\\n';
        const blob=new Blob([js],{type:"text/javascript;charset=utf-8"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url;a.download="users.js";a.click();
        URL.revokeObjectURL(url);
        toast("users.js сформирован","Замените им файл на хостинге");
      };
    }
  }
}
function impersonate(id){
  if(!isAdmin())return;
  clearSalesTimer();
  const s=session();s.impersonating=id;setSession(s);applyIdentity();renderAll();go("home");toast("Открыт кабинет пользователя");
}
function returnAdmin(){
  clearSalesTimer();
  const s=session();delete s.impersonating;setSession(s);applyIdentity();renderAll();go("users")
}
function renderAll(){
  applyIdentity();
  renderHome();
  renderCards();
  renderSettings();
  renderTrades("sales");
  renderTrades("buy");
  renderDeposits();
  renderMessages();
  renderNotifications();
  renderAnalytics();
  renderUsers();
  renderSalesReceiverState();
  const u=actingUser();
  if(u && data().salesReceiving && canReceiveSales(u.id)){
    if(!salesTimer || salesTimerUserId!==u.id) scheduleNextSale(u.id);
  }else{
    clearSalesTimer();
  }
}

init();

$("#loginForm").onsubmit=e=>{
  e.preventDefault();
  const email=$("#loginEmail").value.trim().toLowerCase(), pass=$("#loginPassword").value;
  const users=getUsers(), u=users.find(x=>x.email.toLowerCase()===email&&x.password===pass);
  if(!u){toast("Неверный email или пароль");return}
  if(!u.active){toast("Доступ к кабинету заблокирован");return}
  u.lastLogin=now();
  setSession({userId:u.id});showApp();go(u.role==="admin"?"users":"home")
};
$("#togglePassword").onclick=()=>{const x=$("#loginPassword");x.type=x.type==="password"?"text":"password";$("#togglePassword").textContent=x.type==="password"?"Показать":"Скрыть"};
$("#logoutBtn").onclick=()=>{closeAccountMenu();clearSalesTimer();localStorage.removeItem(KEYS.session);showLogin()};
$("#returnAdminBtn").onclick=()=>{closeAccountMenu();returnAdmin()};

let accountCloseTimer=null;

function clearAccountCloseTimer(){
  if(accountCloseTimer){
    clearTimeout(accountCloseTimer);
    accountCloseTimer=null;
  }
}

function openAccountMenu(){
  closeNotifications();
  clearAccountCloseTimer();
  const menu=$("#accountMenu");
  if(!menu)return;
  menu.classList.add("open");
  $("#accountTrigger")?.setAttribute("aria-expanded","true");
}

function closeAccountMenu(){
  clearAccountCloseTimer();
  $("#accountMenu")?.classList.remove("open");
  $("#accountTrigger")?.setAttribute("aria-expanded","false");
}

function scheduleAccountMenuClose(){
  clearAccountCloseTimer();
  accountCloseTimer=setTimeout(()=>{
    closeAccountMenu();
  },3000);
}

function toggleAccountMenu(){
  const menu=$("#accountMenu");
  if(!menu)return;
  if(menu.classList.contains("open")) closeAccountMenu();
  else openAccountMenu();
}

$("#notificationsTrigger").onclick=e=>{
  e.stopPropagation();
  toggleNotifications();
};

$("#notificationsDropdown").onclick=e=>e.stopPropagation();

$("#markNotificationsRead").onclick=e=>{
  e.stopPropagation();
  markAllNotificationsRead();
};

$("#accountTrigger").onclick=e=>{
  e.stopPropagation();
  toggleAccountMenu();
};

$("#accountMenu").addEventListener("mouseenter",()=>{
  openAccountMenu();
});

$("#accountMenu").addEventListener("mouseleave",()=>{
  scheduleAccountMenuClose();
});

$("#accountDropdown").addEventListener("mouseenter",()=>{
  clearAccountCloseTimer();
  openAccountMenu();
});

$("#accountDropdown").addEventListener("mouseleave",()=>{
  scheduleAccountMenuClose();
});

$("#accountDropdown").onclick=e=>e.stopPropagation();

document.addEventListener("click",e=>{
  if(!$("#accountMenu").contains(e.target)) closeAccountMenu();
  if(!$("#notificationsMenu").contains(e.target)) closeNotifications();
});

$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#themeBtn").onclick=()=>{document.body.classList.toggle("light");write(KEYS.theme,document.body.classList.contains("light")?"light":"dark")};
if(read(KEYS.theme,"dark")==="light")document.body.classList.add("light");
$$(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));
$$("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
$("#addCardBtn").onclick=()=>openCardModal();
$("#calculateAnalyticsBtn").onclick=calculateAnalytics; $("#balanceReportBtn").onclick=()=>toast("Отчёт готов","Показатели обновлены");
$("#salesReceiving").onchange=e=>setSalesReceiving(e.target.checked); $("#buyOnlyActive").onchange=()=>renderTrades("buy");
$$(".tabs").forEach(t=>t.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{t.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));tradeFilters[t.dataset.type]=b.dataset.filter;renderTrades(t.dataset.type)}));
$("#depositBtn").onclick=depositModal;
$("#calculateDisputesBtn").onclick=()=>toast("Расчёт выполнен","Открытых диспутов нет");
$("#addUserBtn").onclick=()=>userModal();
$("#modalClose").onclick=closeModal; $("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};

if(session())showApp();else showLogin();
