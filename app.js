const STORAGE_KEY = "lifeos_v1";
const defaultState = {
  profile: { name: "Rafael", dailyGoal: 0.85, theme: "light" },
  habits: [
    {id:crypto.randomUUID(),name:"Entrenar",icon:"🏋️",color:"#2563eb",frequency:"weekdays",customDays:[],monthlyGoal:20,xp:25,active:true},
    {id:crypto.randomUUID(),name:"Leer",icon:"📚",color:"#16a34a",frequency:"daily",customDays:[],monthlyGoal:25,xp:15,active:true},
    {id:crypto.randomUUID(),name:"Tomar agua",icon:"💧",color:"#0ea5e9",frequency:"daily",customDays:[],monthlyGoal:28,xp:10,active:true},
    {id:crypto.randomUUID(),name:"Meditar",icon:"🧘",color:"#8b5cf6",frequency:"daily",customDays:[],monthlyGoal:20,xp:15,active:true}
  ],
  logs: {},
  createdAt: new Date().toISOString()
};
let state = loadState();

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const iso = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const todayKey = () => iso(new Date());
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(defaultState);
    const parsed=JSON.parse(raw);
    return {...structuredClone(defaultState),...parsed,profile:{...defaultState.profile,...parsed.profile}};
  }catch{return structuredClone(defaultState)}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}

function isScheduled(habit,date){
  if(!habit.active) return false;
  const day=date.getDay();
  if(habit.frequency==="daily") return true;
  if(habit.frequency==="weekdays") return day>=1&&day<=5;
  if(habit.frequency==="weekends") return day===0||day===6;
  if(habit.frequency==="custom") return habit.customDays.includes(day);
  return true;
}
function scheduledHabits(date){return state.habits.filter(h=>isScheduled(h,date))}
function completedCount(date){
  const key=iso(date), habits=scheduledHabits(date);
  return habits.filter(h=>state.logs[key]?.[h.id]===true).length;
}
function completionRate(date){
  const habits=scheduledHabits(date); if(!habits.length)return 0;
  return completedCount(date)/habits.length;
}
function totalXP(){
  let xp=0;
  Object.entries(state.logs).forEach(([date,items])=>{
    state.habits.forEach(h=>{if(items[h.id])xp+=Number(h.xp||0)});
    if(completionRate(new Date(date+"T12:00:00"))>=1 && scheduledHabits(new Date(date+"T12:00:00")).length) xp+=50;
  });
  return xp;
}
function levelInfo(){
  const xp=totalXP(); const level=Math.floor(xp/250)+1; const within=xp%250;
  return {xp,level,within,next:250};
}
function streaks(){
  let current=0,best=0,temp=0,perfect=0;
  const start=new Date(state.createdAt);start.setHours(12,0,0,0);
  const now=new Date();now.setHours(12,0,0,0);
  for(let d=new Date(start);d<=now;d.setDate(d.getDate()+1)){
    const scheduled=scheduledHabits(d);
    const good=scheduled.length>0 && completionRate(d)>=state.profile.dailyGoal;
    if(good){temp++;best=Math.max(best,temp);perfect+=completionRate(d)===1?1:0}else temp=0;
  }
  for(let d=new Date(now);;d.setDate(d.getDate()-1)){
    const scheduled=scheduledHabits(d);
    if(!scheduled.length){continue}
    if(completionRate(d)>=state.profile.dailyGoal)current++; else break;
  }
  return {current,best,perfect};
}
function dateLabel(){
  const d=new Date();
  $("#todayLabel").textContent=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
  const hour=d.getHours(); const part=hour<12?"Buenos días":hour<19?"Buenas tardes":"Buenas noches";
  $("#viewTitle").textContent=part;
  $("#greetingTitle").textContent=`${part}, ${state.profile.name}.`;
  $("#profileBtn").textContent=(state.profile.name||"R").trim()[0].toUpperCase();
}
function renderDashboard(){
  dateLabel();
  const rate=completionRate(new Date()), s=streaks(), lvl=levelInfo();
  $("#todayCompletion").textContent=Math.round(rate*100)+"%";
  $("#currentStreak").textContent=s.current+" días";
  $("#bestStreak").textContent=s.best+" días";
  $("#perfectDays").textContent=s.perfect;
  $("#levelNumber").textContent=lvl.level; $("#levelText").textContent=`Nivel ${lvl.level}`;
  $("#xpText").textContent=`${lvl.within} / ${lvl.next} XP`; $("#xpBar").style.width=(lvl.within/lvl.next*100)+"%";

  const list=$("#todayHabits"); list.innerHTML="";
  const habits=scheduledHabits(new Date());
  $("#emptyToday").classList.toggle("hidden",habits.length>0);
  habits.forEach(h=>{
    const done=!!state.logs[todayKey()]?.[h.id];
    const row=document.createElement("div"); row.className="habit-row"+(done?" done":"");
    row.style.setProperty("--habit-color",h.color);
    row.innerHTML=`<button class="habit-check" aria-label="Marcar hábito">${done?"✓":h.icon}</button>
      <div><div class="habit-name">${escapeHtml(h.name)}</div><div class="habit-meta">${frequencyLabel(h.frequency)} · Meta ${h.monthlyGoal}/mes</div></div>
      <span class="habit-xp">+${h.xp} XP</span>`;
    row.querySelector("button").onclick=()=>toggleHabit(h.id);
    list.appendChild(row);
  });
  renderWeek();renderHeatmap();
}
function toggleHabit(id){
  const key=todayKey(); state.logs[key]??={};
  state.logs[key][id]=!state.logs[key][id]; saveState(); renderAll();
  toast(state.logs[key][id]?"¡Hábito completado!":"Marcado como pendiente");
}
function renderWeek(){
  const box=$("#weekChart");box.innerHTML="";let sum=0;
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);const r=completionRate(d);sum+=r;
    const c=document.createElement("div");c.className="week-col";
    c.innerHTML=`<div class="week-bar-wrap"><div class="week-bar" style="height:${Math.max(3,r*100)}%"></div></div><small>${d.toLocaleDateString("es-AR",{weekday:"short"}).slice(0,2)}</small>`;
    box.appendChild(c);
  }
  $("#weekAverage").textContent=Math.round(sum/7*100)+"%";
}
function renderHeatmap(){
  const map=$("#heatmap");map.innerHTML="";
  const now=new Date(), start=new Date(now.getFullYear(),0,1);
  for(let d=new Date(start);d<=now;d.setDate(d.getDate()+1)){
    const r=completionRate(d), cell=document.createElement("div");
    cell.className="heat-cell "+(r===0?"":r<.4?"l1":r<.7?"l2":r<1?"l3":"l4");
    cell.title=`${iso(d)} · ${Math.round(r*100)}%`;map.appendChild(cell);
  }
}
function renderHabits(){
  const box=$("#habitsManager");box.innerHTML="";
  state.habits.forEach(h=>{
    const row=document.createElement("div");row.className="habit-manager-row";
    row.innerHTML=`<div class="habit-manager-name"><span class="habit-manager-icon" style="background:${h.color}">${h.icon}</span><div><strong>${escapeHtml(h.name)}</strong><div class="habit-meta">Meta ${h.monthlyGoal} veces al mes</div></div></div>
    <span>${frequencyLabel(h.frequency)}</span><span>${h.monthlyGoal}/mes</span><span>${h.xp}</span>
    <span class="status-pill ${h.active?"":"off"}">${h.active?"Activo":"Pausado"}</span>
    <div class="row-actions"><button class="mini-btn edit">✎</button><button class="mini-btn delete">×</button></div>`;
    row.querySelector(".edit").onclick=()=>openHabit(h);
    row.querySelector(".delete").onclick=()=>deleteHabit(h.id);
    box.appendChild(row);
  });
}
function frequencyLabel(f){return ({daily:"Todos los días",weekdays:"Lun–Vie",weekends:"Fin de semana",custom:"Personalizado"})[f]||f}
function openHabit(h=null){
  $("#habitModalTitle").textContent=h?"Editar hábito":"Nuevo hábito";
  $("#habitId").value=h?.id||""; $("#habitName").value=h?.name||""; $("#habitIcon").value=h?.icon||"✓";
  $("#habitColor").value=h?.color||"#2563eb"; $("#habitFrequency").value=h?.frequency||"daily";
  $("#habitXP").value=h?.xp||10; $("#habitMonthlyGoal").value=h?.monthlyGoal||20; $("#habitActive").checked=h?.active??true;
  $$("#customDays input").forEach(i=>i.checked=(h?.customDays||[]).includes(Number(i.value)));
  toggleCustomDays();$("#habitDialog").showModal();
}
function saveHabit(e){
  e.preventDefault();
  const id=$("#habitId").value||crypto.randomUUID();
  const data={id,name:$("#habitName").value.trim(),icon:$("#habitIcon").value.trim()||"✓",color:$("#habitColor").value,
    frequency:$("#habitFrequency").value,xp:Number($("#habitXP").value),monthlyGoal:Number($("#habitMonthlyGoal").value),
    active:$("#habitActive").checked,customDays:$$("#customDays input:checked").map(i=>Number(i.value))};
  if(!data.name)return;
  const idx=state.habits.findIndex(h=>h.id===id); if(idx>=0)state.habits[idx]=data;else state.habits.push(data);
  saveState();$("#habitDialog").close();renderAll();toast("Hábito guardado");
}
function deleteHabit(id){
  if(!confirm("¿Eliminar este hábito? Los registros históricos permanecerán en la copia de seguridad, pero ya no se mostrarán."))return;
  state.habits=state.habits.filter(h=>h.id!==id);saveState();renderAll();toast("Hábito eliminado");
}
function renderStats(){
  const days=Number($("#statsRange").value), now=new Date(), data=[];
  let completed=0,entries=0,xp=0,sum=0;
  for(let i=days-1;i>=0;i--){
    const d=new Date(now);d.setDate(d.getDate()-i);const r=completionRate(d), scheduled=scheduledHabits(d);
    const done=completedCount(d);data.push({d,r});sum+=r;completed+=done;entries+=scheduled.length;
    scheduled.forEach(h=>{if(state.logs[iso(d)]?.[h.id])xp+=h.xp});
  }
  $("#statsAverage").textContent=Math.round(sum/days*100)+"%";$("#statsCompleted").textContent=completed;
  $("#statsEntries").textContent=entries;$("#statsXP").textContent=xp;
  drawTrend(data);renderRanking(days);
}
function drawTrend(data){
  const canvas=$("#trendCanvas"),ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1;
  const rect=canvas.getBoundingClientRect();canvas.width=rect.width*dpr;canvas.height=320*dpr;ctx.scale(dpr,dpr);
  const w=rect.width,h=320,p=34;ctx.clearRect(0,0,w,h);
  const css=getComputedStyle(document.documentElement);ctx.strokeStyle=css.getPropertyValue("--line");ctx.fillStyle=css.getPropertyValue("--muted");ctx.font="12px system-ui";
  [0,.25,.5,.75,1].forEach(v=>{const y=h-p-v*(h-p*2);ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke();ctx.fillText(Math.round(v*100)+"%",2,y+4)});
  ctx.strokeStyle=css.getPropertyValue("--primary");ctx.lineWidth=3;ctx.beginPath();
  data.forEach((o,i)=>{const x=p+i*(w-p*2)/Math.max(1,data.length-1),y=h-p-o.r*(h-p*2);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
}
function renderRanking(days){
  const box=$("#habitRanking");box.innerHTML="";const now=new Date();
  state.habits.filter(h=>h.active).map(h=>{
    let done=0,total=0;
    for(let i=0;i<days;i++){const d=new Date(now);d.setDate(d.getDate()-i);if(isScheduled(h,d)){total++;if(state.logs[iso(d)]?.[h.id])done++}}
    return {h,rate:total?done/total:0,done,total}
  }).sort((a,b)=>b.rate-a.rate).forEach(({h,rate,done,total})=>{
    const row=document.createElement("div");row.className="rank-row";
    row.innerHTML=`<strong>${h.icon} ${escapeHtml(h.name)}</strong><span>${Math.round(rate*100)}%</span>
      <div class="rank-meta"><span>${done} completados</span><span>${total} oportunidades</span></div>
      <div class="rank-track"><span style="width:${rate*100}%;background:${h.color}"></span></div>`;box.appendChild(row);
  });
}
const achievements=[
  {icon:"🌱",title:"Primer paso",desc:"Completá tu primer hábito.",test:()=>countAllDone()>=1},
  {icon:"🔥",title:"Semana encendida",desc:"Alcanzá una racha de 7 días.",test:()=>streaks().best>=7},
  {icon:"🏆",title:"Mes disciplinado",desc:"Completá 30 días perfectos.",test:()=>streaks().perfect>=30},
  {icon:"⚡",title:"Mil de experiencia",desc:"Acumulá 1.000 XP.",test:()=>totalXP()>=1000},
  {icon:"💎",title:"Imparable",desc:"Alcanzá una racha de 30 días.",test:()=>streaks().best>=30},
  {icon:"👑",title:"Maestro LifeOS",desc:"Llegá al nivel 20.",test:()=>levelInfo().level>=20}
];
function countAllDone(){let n=0;Object.values(state.logs).forEach(o=>Object.values(o).forEach(v=>{if(v)n++}));return n}
function renderAchievements(){
  const box=$("#achievementsGrid");box.innerHTML="";
  achievements.forEach(a=>{const unlocked=a.test(),el=document.createElement("article");el.className="card achievement"+(unlocked?"":" locked");
    el.innerHTML=`<div class="achievement-icon">${a.icon}</div><h3>${a.title}</h3><p>${a.desc}</p><small>${unlocked?"DESBLOQUEADO":"BLOQUEADO"}</small>`;box.appendChild(el)});
}
function renderSettings(){
  $("#nameInput").value=state.profile.name;$("#dailyGoalInput").value=String(state.profile.dailyGoal);
}
function saveSettings(){
  state.profile.name=$("#nameInput").value.trim()||"Rafael";state.profile.dailyGoal=Number($("#dailyGoalInput").value);
  saveState();renderAll();toast("Configuración guardada");
}
function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`lifeos-backup-${todayKey()}.json`;a.click();URL.revokeObjectURL(url);toast("Copia exportada");
}
function importData(file){
  const reader=new FileReader();reader.onload=()=>{
    try{const parsed=JSON.parse(reader.result);if(!parsed.habits||!parsed.logs)throw Error();state=parsed;saveState();renderAll();toast("Copia importada")}
    catch{alert("El archivo no parece ser una copia válida de LifeOS.")}
  };reader.readAsText(file);
}
function resetData(){
  if(!confirm("¿Seguro? Esta acción no se puede deshacer."))return;
  localStorage.removeItem(STORAGE_KEY);state=structuredClone(defaultState);saveState();renderAll();toast("Datos reiniciados");
}
function setTheme(theme){
  state.profile.theme=theme;document.documentElement.dataset.theme=theme;saveState();
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function switchView(name){
  $$(".view").forEach(v=>v.classList.remove("active"));$("#view-"+name).classList.add("active");
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===name));
  $("#sidebar").classList.remove("open");
  if(name==="stats")renderStats();if(name==="achievements")renderAchievements();
}
function toggleCustomDays(){$("#customDays").classList.toggle("hidden",$("#habitFrequency").value!=="custom")}
function renderAll(){document.documentElement.dataset.theme=state.profile.theme;renderDashboard();renderHabits();renderStats();renderAchievements();renderSettings()}

$$(".nav-item").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$$("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#themeBtn").onclick=()=>setTheme(state.profile.theme==="dark"?"light":"dark");
$("#addHabitBtn").onclick=()=>openHabit();
$("#habitFrequency").onchange=toggleCustomDays;
$("#habitForm").addEventListener("submit",saveHabit);
$("#saveSettingsBtn").onclick=saveSettings;
$("#exportBtn").onclick=exportData;
$("#importInput").onchange=e=>e.target.files[0]&&importData(e.target.files[0]);
$("#resetBtn").onclick=resetData;
$("#statsRange").onchange=renderStats;
window.addEventListener("resize",()=>{if($("#view-stats").classList.contains("active"))renderStats()});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
renderAll();