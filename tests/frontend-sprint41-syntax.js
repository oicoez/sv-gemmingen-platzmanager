
const $=id=>document.getElementById(id);let pin="",timer=null,includePast=false,weekStart="",monthValue="",serverToday="",editingTrainingId="",resourceCache=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=v=>{const s=String(v||"").slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:s};
const fmtStatus=v=>({planned:"geplant",cancelled:"abgesetzt",rescheduled:"verlegt"}[v]||v||"");
async function json(url,opt){const r=await fetch(url,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||j.detail||`HTTP ${r.status}`);return j}
function addDays(s,n){const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const dayNames=["Mo","Di","Mi","Do","Fr","Sa","So"];

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));
 ["dashboard","week","month","training","resources","games"].forEach(v=>$(`view-${v}`).classList.toggle("hidden",b.dataset.view!==v));
 if(b.dataset.view==="dashboard")loadDashboard();
 if(b.dataset.view==="week")loadWeek();
 if(b.dataset.view==="month")loadMonth();
 if(b.dataset.view==="training"){loadTrainings();loadCabins();}
 if(b.dataset.view==="resources")loadResources();
});

async function bootstrapToday(){
 const t=await json("/api/v5/system/today");
 serverToday=t.today;weekStart=t.weekStart;monthValue=t.month;$("trDate").value=t.today;
}
async function check(){try{await json("/health");$("health").textContent="ClubPlanner 5.0 online";$("health").classList.add("good")}catch{$("health").textContent="Systemfehler";$("health").classList.add("bad")}}
async function loadTeams(){const j=await json("/api/v5/teams");$("trTeam").innerHTML=(j.items||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}
$("login").onclick=async()=>{const p=prompt("Bearbeitungs-PIN:");if(!p)return;try{await json("/api/v5/auth/check",{method:"POST",headers:{"content-type":"application/json","x-edit-pin":p}});pin=p;$("sync").disabled=false;$("saveTraining").disabled=false;$("login").textContent="Bearbeitungsmodus aktiv";loadTrainings()}catch(e){alert(e.message)}};

async function loadDashboard(){
 try{
  const j=await json("/api/v5/dashboard/week");
  $("dashWeek").textContent=`${fmtDate(j.weekStart)} – ${fmtDate(j.weekEnd)}`;
  $("dashGames").textContent=j.games;$("dashTrainings").textContent=j.trainings;$("dashConflicts").textContent=j.conflicts;
  $("dashConflicts").className="big "+(j.conflicts?"bad":"good");
  $("dashboardList").innerHTML=j.events.length?j.events.map(x=>`<div class="dashEvent ${x.conflict?"conflict":""}">
   <div><b>${fmtDate(x.date)}</b></div><div><b>${x.start}</b></div>
   <div><span class="${x.eventType==="home_match"?"typeGame":"typeTraining"}">${x.eventType==="home_match"?"SPIEL":"TRAINING"}</span><br>${esc(x.label)}${x.conflict?`<br><span class="conflictPill">Konflikt</span>`:""}</div>
   <div>${esc(x.location)}<br>${esc(x.baseName)}</div><div>${esc(x.segments.map(s=>`${s.start}–${s.end} ${s.sectionLabel}`).join(" · "))}</div>
  </div>`).join(""):`<div class="empty">Diese Woche stehen keine lokalen Spiele oder Trainings an.</div>`;
 }catch(e){$("dashboardList").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}

async function loadWeek(useServerCurrent=false){
 try{
  const url=useServerCurrent?"/api/v5/planner/week":"/api/v5/planner/week?start="+encodeURIComponent(weekStart);
  const j=await json(url);weekStart=j.start;
  $("weekTitle").textContent=`Woche ${fmtDate(j.start)} – ${fmtDate(j.end)}`;
  $("conflictCount").textContent=j.conflicts.length?`${j.conflicts.length} Konflikt(e)`:"Keine Konflikte";
  $("conflictCount").className="badge "+(j.conflicts.length?"bad":"good");
  $("weekDays").innerHTML=j.days.map((d,idx)=>`<div class="day"><div class="dayhead">${dayNames[idx]}, ${fmtDate(d.date)}</div>${d.groups.length?d.groups.map(g=>`<div class="pitch"><div class="pitchtitle">${esc(g.location)} · ${esc(g.baseName)}</div>${g.segments.map(s=>`<div class="seg ${s.conflict?"conflict":(s.items.length===2?"split":"")}"><div class="time">${s.start}–${s.end}</div>${s.items.map(i=>`<div>${esc(i.label)} · <span class="${i.section.startsWith("half")?"half":""}">${esc(i.sectionLabel)}</span></div>`).join("")}${s.conflict?`<div class="conflictText">${esc(s.reason)}</div>`:""}</div>`).join("")}</div>`).join(""):`<div class="empty">frei</div>`}</div>`).join("");
 }catch(e){$("weekDays").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}
$("prevWeek").onclick=()=>{weekStart=addDays(weekStart,-7);loadWeek();loadTrainings()};
$("nextWeek").onclick=()=>{weekStart=addDays(weekStart,7);loadWeek();loadTrainings()};
$("todayWeek").onclick=async()=>{const t=await json("/api/v5/system/today");weekStart=t.weekStart;await loadWeek(true);await loadTrainings()};

function monthShift(ym,delta){const [y,m]=ym.split("-").map(Number),d=new Date(Date.UTC(y,m-1+delta,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`}
function monthName(ym){const [y,m]=ym.split("-").map(Number);return new Intl.DateTimeFormat("de-DE",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(y,m-1,1)))}
async function loadMonth(useServerCurrent=false){
 $("monthError").innerHTML="";
 try{
  const url=useServerCurrent?"/api/v5/planner/month":"/api/v5/planner/month?month="+encodeURIComponent(monthValue);
  const j=await json(url);monthValue=j.month;
  $("monthTitle").textContent=monthName(j.month);
  $("monthConflictCount").textContent=j.conflictCount?`${j.conflictCount} Konflikt(e)`:"Keine Konflikte";
  $("monthConflictCount").className="badge "+(j.conflictCount?"bad":"good");
  const [yy,mm]=j.month.split("-").map(Number),firstDow=(new Date(Date.UTC(yy,mm-1,1)).getUTCDay()+6)%7,cells=[];
  for(let i=0;i<firstDow;i++)cells.push(`<div class="monthday blank"></div>`);
  for(const d of j.days){
   const entries=[];
   for(const g of d.groups)for(const s of g.segments){
    const labels=s.items.map(i=>`${i.eventType==="home_match"?"SPIEL":"Training"}: ${i.label}${i.sectionLabel!=="Gesamt"?` (${i.sectionLabel})`:""}`).join(" / ");
    entries.push(`<div class="monthitem ${s.conflict?"conflict":(s.items.length===2?"split":"")}"><b>${s.start}–${s.end}</b><br>${esc(g.location)} · ${esc(g.baseName)}<br>${esc(labels)}${s.conflict?`<br><b class="bad">KONFLIKT</b>`:""}</div>`);
   }
   cells.push(`<div class="monthday"><div class="monthnum">${Number(d.date.slice(-2))}</div>${entries.join("")}</div>`);
  }
  $("monthGrid").innerHTML=`${["Mo","Di","Mi","Do","Fr","Sa","So"].map(x=>`<div class="monthdow">${x}</div>`).join("")}${cells.join("")}`;
 }catch(e){$("monthError").innerHTML=`<div class="errorBox">Monatsansicht konnte nicht geladen werden: ${esc(e.message)}</div>`;$("monthGrid").innerHTML=""}
}
$("prevMonth").onclick=()=>{monthValue=monthShift(monthValue,-1);loadMonth()};
$("nextMonth").onclick=()=>{monthValue=monthShift(monthValue,1);loadMonth()};
$("todayMonth").onclick=async()=>{const t=await json("/api/v5/system/today");monthValue=t.month;await loadMonth(true)};


async function loadResources(){
 try{
  const j=await json("/api/v5/resources/overview");
  $("resourceOverview").innerHTML=(j.locations||[]).map(loc=>`<div class="resourceLocation">
    <h3>${esc(loc.name)}</h3><div class="muted">${esc(loc.address)}</div>
    ${loc.pitches.map(p=>`<div class="resourcePitch"><b>${esc(p.baseName)}</b>
      <div class="resourceTags"><span class="resourceTag">Gesamt</span><span class="resourceTag">Hälfte A</span><span class="resourceTag">Hälfte B</span></div>
    </div>`).join("")}
    <div><b>Kabinen</b><div class="resourceCabins">${loc.cabins.map(c=>`<span class="resourceCabin">${esc(c.name)}</span>`).join("")}</div></div>
  </div>`).join("");
 }catch(e){$("resourceOverview").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}
async function loadCabins(){
 try{
  const j=await json("/api/v5/resources");
  resourceCache=j.items||[];
  const location=$("trLocation").value;
  const cabins=resourceCache.filter(x=>x.location_id===location&&x.resource_type==="cabin");
  const opts=`<option value="">keine</option>`+cabins.map(x=>`<option value="${x.id}">${esc(x.ui_name||x.display_name)}</option>`).join("");
  const old1=$("trCabin1").value,old2=$("trCabin2").value;
  $("trCabin1").innerHTML=opts;$("trCabin2").innerHTML=opts;
  if(cabins.some(x=>x.id===old1))$("trCabin1").value=old1;
  if(cabins.some(x=>x.id===old2))$("trCabin2").value=old2;
 }catch(e){console.error(e)}
}
$("trLocation").addEventListener("change",()=>{ $("trCabin1").value="";$("trCabin2").value="";loadCabins() });

function clearTrainingForm(){
 editingTrainingId="";
 $("saveTraining").textContent="Training speichern";
 $("cancelEdit").classList.add("hidden");
 $("trainingMsg").textContent="";
 $("trNote").value="";
 $("trCabin1").value="";
 $("trCabin2").value="";
}
$("cancelEdit").onclick=clearTrainingForm;

async function editTrainingForm(id){
 try{
  const j=await json("/api/v5/trainings/"+id),x=j.item;
  editingTrainingId=id;
  $("trTeam").value=x.team_id;
  $("trDate").value=fmtDateInput(x.event_date);
  $("trStart").value=String(x.start_time||"").slice(0,5);
  $("trEnd").value=String(x.end_time||"").slice(0,5);
  $("trLocation").value=x.location_id;
  $("trBase").value=x.pitch_base||"Hauptplatz";
  $("trMode").value=x.allocation_mode||"flexible";
  $("trNote").value=x.note||"";
  await loadCabins();
  $("trCabin1").value=x.home_cabin_id||"";
  $("trCabin2").value=x.guest_cabin_id||"";
  $("saveTraining").textContent="Änderungen speichern";
  $("cancelEdit").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
 }catch(e){alert(e.message)}
}
function fmtDateInput(v){return String(v||"").slice(0,10)}

async function loadTrainings(){
 try{
  const to=addDays(weekStart,6);
  const [tj,wj]=await Promise.all([json(`/api/v5/trainings?from=${weekStart}&to=${to}`),json(`/api/v5/planner/week?start=${weekStart}`)]);
  const items=tj.items||[],conflictById=new Map();
  for(const c of wj.conflicts||[])for(const item of c.items||[]){
   if(item.eventType!=="training")continue;
   const others=(c.items||[]).filter(o=>o.id!==item.id).map(o=>`${o.eventType==="home_match"?"Spiel":"Training"} ${o.label}`).join(", ");
   conflictById.set(item.id,`${c.start}–${c.end}: ${c.reason}${others?` – ${others}`:""}`);
  }
  $("trainingList").innerHTML=items.length?`<table><thead><tr><th>Datum</th><th>Zeit</th><th>Mannschaft</th><th>Ort</th><th>Platz</th><th>Modus</th><th>Kabinen</th><th>Konflikt</th><th></th></tr></thead><tbody>${items.map(x=>{
   const conflict=conflictById.get(x.id)||"";
   return `<tr class="${conflict?"conflictRow":""}"><td>${fmtDate(x.event_date)}</td><td>${String(x.start_time).slice(0,5)}–${String(x.end_time).slice(0,5)}</td><td>${esc(x.team)}</td><td>${esc(x.location)}</td><td>${esc(x.base_name)}</td><td>${esc(({flexible:"flexibel",half_a:"Hälfte A",half_b:"Hälfte B",exclusive:"Gesamt exklusiv"}[x.allocation_mode]||x.allocation_mode))}</td><td>${esc([x.cabin1_label,x.cabin2_label].filter(Boolean).join(" + ")||"–")}</td><td>${conflict?`<span class="conflictPill">Konflikt</span><br>${esc(conflict)}`:"–"}</td><td><div class="toolbar"><button class="editTr" data-id="${x.id}" ${pin?"":"disabled"}>Bearbeiten</button><button class="delTr" data-id="${x.id}" ${pin?"":"disabled"}>Löschen</button></div></td></tr>`;
  }).join("")}</tbody></table>`:`<div class="empty">In dieser Woche sind noch keine Trainings eingetragen.</div>`;
  document.querySelectorAll(".editTr").forEach(b=>b.onclick=()=>editTrainingForm(b.dataset.id));
  document.querySelectorAll(".delTr").forEach(b=>b.onclick=async()=>{if(!confirm("Training löschen?"))return;try{await json("/api/v5/trainings/"+b.dataset.id,{method:"DELETE",headers:{"x-edit-pin":pin}});await loadTrainings();await loadWeek();await loadMonth();await loadDashboard()}catch(e){alert(e.message)}})
 }catch(e){$("trainingList").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}
$("saveTraining").onclick=async()=>{try{
 const body={teamId:$("trTeam").value,date:$("trDate").value,start:$("trStart").value,end:$("trEnd").value,locationId:$("trLocation").value,baseName:$("trBase").value,allocationMode:$("trMode").value,cabin1Id:$("trCabin1").value||null,cabin2Id:$("trCabin2").value||null,note:$("trNote").value};
 const url=editingTrainingId?"/api/v5/trainings/"+editingTrainingId:"/api/v5/trainings";
 const method=editingTrainingId?"PUT":"POST";
 await json(url,{method,headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify(body)});
 $("trainingMsg").textContent=editingTrainingId?"Training aktualisiert.":"Training gespeichert.";
 clearTrainingForm();
 const d=new Date(body.date+"T12:00:00Z"),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);weekStart=d.toISOString().slice(0,10);monthValue=body.date.slice(0,7);
 await loadTrainings();await loadWeek();await loadMonth();await loadDashboard()
}catch(e){$("trainingMsg").textContent=e.message}};

async function loadGames(){const j=await json("/api/v5/events"+(includePast?"?includePast=1":"")),e=j.events||[];$("count").textContent=e.length;$("times").textContent=e.filter(x=>x.kickoff_time).length;$("venues").textContent=e.filter(x=>x.location).length;$("cancelled").textContent=e.filter(x=>x.status==="cancelled").length;$("rows").innerHTML=e.map(x=>`<tr class="${x.status==="cancelled"?"cancelled":""}"><td>${fmtDate(x.event_date)}</td><td>${esc((x.kickoff_time||"").slice(0,5))}</td><td>${esc(x.team)}</td><td>${esc(x.opponent)}</td><td>${esc(x.competition)}</td><td>${esc(x.status==="cancelled"?"abgesetzt":x.location||"")}</td><td>${esc(x.resource||"")}</td><td>${esc(x.address)}</td><td>${esc(fmtStatus(x.status))}</td></tr>`).join("")}
$("reload").onclick=loadGames;$("past").onclick=async()=>{includePast=!includePast;$("past").textContent=includePast?"Vergangene Spiele ausblenden":"Vergangene Spiele anzeigen";await loadGames()};
$("sync").onclick=async()=>{if(!confirm("FUSSBALL.DE jetzt synchronisieren?"))return;try{await json("/api/v5/sync/fussballde",{method:"POST",headers:{"x-edit-pin":pin}});$("sync").disabled=true;poll()}catch(e){alert(e.message)}};
async function poll(){try{const s=await json("/api/v5/sync/status");$("syncState").textContent=s.running?`${s.progress} (${s.processed}/${s.total||"?"})`:s.progress;if(s.running){clearTimeout(timer);timer=setTimeout(poll,1000)}else{$("sync").disabled=!pin;await loadGames();await loadWeek();await loadMonth();await loadDashboard()}}catch(e){$("syncState").textContent=e.message}}

(async()=>{try{await bootstrapToday();await Promise.all([check(),loadTeams(),loadGames(),loadResources()]);await loadCabins();await loadDashboard();await loadWeek();await loadMonth();poll()}catch(e){console.error(e);alert("Startfehler: "+e.message)}})();
