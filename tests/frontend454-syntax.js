
const $=id=>document.getElementById(id);let pin="",timer=null,includePast=false,weekStart="",monthValue="",serverToday="",editingTrainingId="",resourceCache=[],trainingMode="single",editingGameId="",resourceOverviewCache=null,editingManualId="",manualTeamCache=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=v=>{const s=String(v||"").slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:s};
const fmtStatus=v=>({planned:"geplant",cancelled:"abgesetzt",rescheduled:"verlegt"}[v]||v||"");
async function json(url,opt){const r=await fetch(url,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||j.detail||`HTTP ${r.status}`);return j}
function addDays(s,n){const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const dayNames=["Mo","Di","Mi","Do","Fr","Sa","So"];

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));
 ["dashboard","week","month","training","resources","teams","games"].forEach(v=>$(`view-${v}`).classList.toggle("hidden",b.dataset.view!==v));
 if(b.dataset.view==="dashboard")loadDashboard();
 if(b.dataset.view==="week")loadWeek();
 if(b.dataset.view==="month")loadMonth();
 if(b.dataset.view==="training"){syncTrainingModeUI();loadTrainings();loadCabins();loadSeries();}
 if(b.dataset.view==="resources")loadResources();
 if(b.dataset.view==="teams")loadTeamManager();
});

document.addEventListener("click",async e=>{
 const trainingTarget=e.target.closest("[data-training-id]");
 if(trainingTarget){
  const id=trainingTarget.dataset.trainingId;if(!id)return;
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view==="training"));
  ["dashboard","week","month","training","resources","teams","games"].forEach(v=>$(`view-${v}`).classList.toggle("hidden",v!=="training"));
  await editTrainingForm(id);return;
 }
 const manualTarget=e.target.closest("[data-manual-id]");
 if(manualTarget){const id=manualTarget.dataset.manualId;if(id){await editManualDialog(id);return}}
 const gameTarget=e.target.closest("[data-game-id]");
 if(gameTarget){
  const id=gameTarget.dataset.gameId;if(!id)return;
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view==="games"));
  ["dashboard","week","month","training","resources","teams","games"].forEach(v=>$(`view-${v}`).classList.toggle("hidden",v!=="games"));
  await editGameForm(id);
 }
});

async function bootstrapToday(){
 const t=await json("/api/v5/system/today");
 serverToday=t.today;weekStart=t.weekStart;monthValue=t.month;$("trDate").value=t.today;$("seriesStartDate").value=t.today;$("seriesEndDate").value=addDays(t.today,180);
}
async function check(){try{await json("/health");$("health").textContent="ClubPlanner 5.0 online";$("health").classList.add("good")}catch{$("health").textContent="Systemfehler";$("health").classList.add("bad")}}
async function loadTeams(){
 const selected=$("trTeam").value;
 const j=await json("/api/v5/teams");manualTeamCache=j.items||[];
 $("trTeam").innerHTML=manualTeamCache.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
 if(manualTeamCache.some(x=>x.id===selected))$("trTeam").value=selected;
 fillManualTeams();return manualTeamCache;
}
async function loadTeamManager(){
 try{
  const items=await loadTeams();
  $("teamList").innerHTML=items.length?`<table><thead><tr><th>Mannschaft</th><th>FUSSBALL.DE</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.name)}</td><td>exakter Namensabgleich</td><td><button class="delTeam" data-id="${x.id}" ${pin?"":"disabled"}>Entfernen</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">Keine Mannschaften angelegt.</div>`;
  document.querySelectorAll(".delTeam").forEach(b=>b.onclick=async()=>{if(!confirm("Mannschaft entfernen? Künftige FUSSBALL.DE-Spiele werden aus dem lokalen Kalender entfernt."))return;await json("/api/v5/teams/"+b.dataset.id,{method:"DELETE",headers:{"x-edit-pin":pin}});$("teamMsg").textContent="Mannschaft entfernt.";await loadTeamManager();});
 }catch(e){$("teamList").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}
$("addTeam").onclick=async()=>{try{
 const name=$("newTeamName").value.trim();if(!name)throw new Error("Bitte Mannschaftsname eingeben");
 await json("/api/v5/teams",{method:"POST",headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify({name})});
 $("newTeamName").value="";$("teamMsg").textContent="Mannschaft hinzugefügt. Beim nächsten FUSSBALL.DE-Sync wird exakt dieser Name berücksichtigt.";await loadTeamManager();
}catch(e){$("teamMsg").textContent=e.message}};
$("login").onclick=async()=>{const p=prompt("Bearbeitungs-PIN:");if(!p)return;try{await json("/api/v5/auth/check",{method:"POST",headers:{"content-type":"application/json","x-edit-pin":p}});pin=p;$("sync").disabled=false;$("saveTraining").disabled=false;$("addTeam").disabled=false;$("saveGame").disabled=false;$("resetGames").disabled=false;$("addPlace").disabled=false;$("saveManual").disabled=false;$("login").textContent="Bearbeitungsmodus aktiv";loadTrainings()}catch(e){alert(e.message)}};

async function loadDashboard(){
 try{
  const j=await json("/api/v5/dashboard/week");
  $("dashWeek").textContent=`${fmtDate(j.weekStart)} – ${fmtDate(j.weekEnd)}`;
  $("dashGames").textContent=j.games;$("dashTrainings").textContent=j.trainings;$("dashConflicts").textContent=j.conflicts;
  $("dashConflicts").className="big "+(j.conflicts?"bad":"good");
  $("dashboardList").innerHTML=j.events.length?j.events.map(x=>`<div class="dashEvent ${x.conflict?"conflict":""}">
   <div><b>${fmtDate(x.date)}</b></div><div><b>${x.start}</b></div>
   <div><span class="${x.eventType==="home_match"?"typeGame":"typeTraining"}">${x.eventType==="home_match"?"SPIEL":"TRAINING"}</span><br>${esc(x.label)}${x.conflict?`<br><span class="conflictPill">Konflikt</span>`:""}</div>
   <div><b>${esc(x.location)} · ${esc(x.baseName)}</b></div><div>${esc(x.segments.map(s=>`${s.start}–${s.end} ${s.sectionLabel}`).join(" · "))}</div>
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
  $("weekDays").innerHTML=j.days.map((d,idx)=>`<div class="day"><div class="dayhead">${dayNames[idx]}, ${fmtDate(d.date)}</div>${d.groups.length?d.groups.map(g=>`<div class="pitch"><div class="pitchtitle"><span class="placeSwatch" style="background:${esc(g.color||"#f5f7f9")}"></span><b>${esc(g.location)} · ${esc(g.baseName)}</b></div>${g.segments.map(s=>`<div class="seg ${s.conflict?"conflict":(s.items.length===2?"split":"")}" style="--place-color:${esc(g.color||"#f5f7f9")}"><div class="time">${s.start}–${s.end}</div>${s.items.map(i=>`<div class="${i.eventType==="training"?"trainingClick":(i.eventType==="home_match"?"trainingClick":"")}" ${i.eventType==="training"?`data-training-id="${esc(i.id)}" title="Training bearbeiten"`:(i.eventType==="home_match"?`data-game-id="${esc(i.id)}" title="Spiel bearbeiten"`:(i.eventType==="manual_event"?`data-manual-id="${esc(i.id)}" title="Manuellen Termin bearbeiten"`:""))}>${i.eventType==="home_match"?"⚽":(i.eventType==="manual_event"?"◆":"●")} ${esc(i.label)}${i.manuallyChanged?` <span class="manualBadge">MANUELL</span>`:""} · <span class="allocationPill ${esc(i.section)}">${esc(i.sectionLabel)}</span></div>`).join("")}${s.conflict?`<div class="conflictText">${esc(s.reason)}</div>`:""}</div>`).join("")}</div>`).join(""):`<div class="empty">frei</div>`}</div>`).join("");
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
    const labels=s.items.map(i=>`${i.eventType==="home_match"?"SPIEL":(i.eventType==="manual_event"?"TERMIN":"Training")}: ${i.label}${i.sectionLabel!=="Gesamt"?` (${i.sectionLabel})`:""}`).join(" / "); const hasManual=s.items.some(i=>i.manuallyChanged);
    const onlyItem=s.items.length===1?s.items[0]:null;
    const clickAttr=onlyItem?.eventType==="training"?`data-training-id="${esc(onlyItem.id)}" title="Training bearbeiten"`:(onlyItem?.eventType==="home_match"?`data-game-id="${esc(onlyItem.id)}" title="Spiel bearbeiten"`:(onlyItem?.eventType==="manual_event"?`data-manual-id="${esc(onlyItem.id)}" title="Manuellen Termin bearbeiten"`:""));
    entries.push(`<div class="monthitem ${s.conflict?"conflict":(s.items.length===2?"split":"")} ${onlyItem?.eventType==="manual_event"?"manualEventClick":(clickAttr?"trainingClick":"")}" style="--place-color:${esc(g.color||"#f5f7f9")}" ${clickAttr}><span class="placeTitle">${esc(g.location)} · ${esc(g.baseName)}</span><br><b>${s.start}–${s.end}</b><br>${esc(labels)}${hasManual?` <span class="manualBadge">MANUELL</span>`:""}${s.conflict?`<br><b class="bad">KONFLIKT</b>`:""}</div>`);
   }
   cells.push(`<div class="monthday" data-date="${esc(d.date)}" title="Klicken: manuellen Termin hinzufügen"><div class="monthnum">${Number(d.date.slice(-2))}</div>${entries.join("")}</div>`);
  }
  $("monthGrid").innerHTML=`${["Mo","Di","Mi","Do","Fr","Sa","So"].map(x=>`<div class="monthdow">${x}</div>`).join("")}${cells.join("")}`;
  document.querySelectorAll("#monthGrid .monthday[data-date]").forEach(el=>el.onclick=e=>{
   if(e.target.closest("[data-training-id],[data-game-id],[data-manual-id]"))return;
   if(!pin){alert("Bitte zuerst Bearbeiten aktivieren.");return}openManualDialog(el.dataset.date);
  });
  document.querySelectorAll("#monthGrid [data-manual-id]").forEach(el=>el.onclick=e=>{e.stopPropagation();editManualDialog(el.dataset.manualId)});
 }catch(e){$("monthError").innerHTML=`<div class="errorBox">Monatsansicht konnte nicht geladen werden: ${esc(e.message)}</div>`;$("monthGrid").innerHTML=""}
}
$("prevMonth").onclick=()=>{monthValue=monthShift(monthValue,-1);loadMonth()};
$("nextMonth").onclick=()=>{monthValue=monthShift(monthValue,1);loadMonth()};
$("todayMonth").onclick=async()=>{const t=await json("/api/v5/system/today");monthValue=t.month;await loadMonth(true)};


function wholePitches(){return resourceCache.filter(x=>x.resource_type==="pitch"&&x.section==="whole")}
function currentPitch(){return wholePitches().find(x=>x.location_id===$("trLocation").value&&x.base_name===$("trBase").value)}
function updateTrainingModeOptions(){
 const p=currentPitch(),n=Number(p?.division_count||1),selected=$("trMode").value;
 const opts=n===1?[["exclusive","Gesamt – nicht teilbar"]]:
   n===3?[["one_third","1/3 Halle"],["two_thirds","2/3 Halle"],["exclusive","Gesamte Halle (3/3)"]]:
   [["flexible","Flexibel – automatisch Gesamt/A/B"],["half_a","Fest Hälfte A"],["half_b","Fest Hälfte B"],["exclusive","Gesamtplatz exklusiv"]];
 $("trMode").innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
 if(opts.some(([v])=>v===selected))$("trMode").value=selected;
}
function updateBaseOptions(){
 const loc=$("trLocation").value,selected=$("trBase").value;
 const bases=wholePitches().filter(x=>x.location_id===loc);
 $("trBase").innerHTML=bases.map(x=>`<option value="${esc(x.base_name)}">${esc(x.base_name)}</option>`).join("");
 if(bases.some(x=>x.base_name===selected))$("trBase").value=selected;
 updateTrainingModeOptions();updateCabinAvailability();
}
function updateLocationOptions(){
 const selected=$("trLocation").value;
 const locs=[];for(const p of wholePitches())if(!locs.some(x=>x.id===p.location_id))locs.push({id:p.location_id,name:p.location_name});
 $("trLocation").innerHTML=locs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
 if(locs.some(x=>x.id===selected))$("trLocation").value=selected;
 updateBaseOptions();
}
function updateCabinAvailability(){
 const hasHome=!!cabinResourceId("home"),hasGuest=!!cabinResourceId("guest");
 $("trCabin1").disabled=!hasHome;$("trCabin2").disabled=!hasGuest;
 if(!hasHome)$("trCabin1").value="";if(!hasGuest)$("trCabin2").value="";
}
async function loadResources(){
 try{
  const [j,r]=await Promise.all([json("/api/v5/resources/overview"),json("/api/v5/resources")]);
  resourceOverviewCache=j;resourceCache=r.items||[];
  $("resourceOverview").innerHTML=(j.locations||[]).map(loc=>`<div class="resourceLocation">
    <h3>${esc(loc.name)}</h3><div class="muted">${esc(loc.address||"Adresse nicht hinterlegt")}</div>
    ${loc.pitches.map(p=>`<div class="resourcePitch">
      <div><span class="placeSwatch" style="background:${esc(p.color)}"></span><b>${esc(p.baseName)}</b> · ${p.divisionCount===1?"nicht teilbar":p.divisionCount===2?"2 Hälften":"3 Drittel"}</div>
      <div class="resourceTags">${p.tags.map(t=>`<span class="resourceTag">${esc(t)}</span>`).join("")}</div>
    </div>`).join("")}
    ${loc.cabins.length?`<div><b>Kabinen</b><div class="resourceCabins">${loc.cabins.map(c=>`<span class="resourceCabin">${esc(c.name)}</span>`).join("")}</div></div>`:""}
    ${loc.userManaged?`<div class="resourceActions">
      <select class="placeColor" data-id="${esc(loc.id)}">${[
       ["#FFF4BF","Gelb"],["#E1F4E5","Grün"],["#E4F1FF","Blau"],["#EFE6FA","Violett"],["#FFE8CC","Orange"],["#F2EBDD","Beige"],["#DFF4F1","Türkis"],["#EEF1F4","Grau"],["#F8E6F0","Rosa"]
      ].map(([v,l])=>`<option value="${v}" ${loc.pitches[0]?.color?.toUpperCase()===v?"selected":""}>${l}</option>`).join("")}</select>
      <button class="savePlaceColor" data-id="${esc(loc.id)}" ${pin?"":"disabled"}>Farbe speichern</button>
      <button class="delPlace" data-id="${esc(loc.id)}" ${pin?"":"disabled"}>Ort entfernen</button>
    </div>`:""}
  </div>`).join("");
  document.querySelectorAll(".savePlaceColor").forEach(b=>b.onclick=async()=>{
    const sel=document.querySelector(`.placeColor[data-id="${CSS.escape(b.dataset.id)}"]`);
    await json(`/api/v5/resources/places/${encodeURIComponent(b.dataset.id)}/color`,{method:"PATCH",headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify({color:sel.value})});
    await Promise.all([loadResources(),loadWeek(),loadMonth(),loadDashboard()]);
  });
  document.querySelectorAll(".delPlace").forEach(b=>b.onclick=async()=>{
    if(!confirm("Trainingsort wirklich entfernen?"))return;
    try{await json(`/api/v5/resources/places/${encodeURIComponent(b.dataset.id)}`,{method:"DELETE",headers:{"x-edit-pin":pin}});await loadResources();$("placeMsg").textContent="Trainingsort entfernt."}catch(e){$("placeMsg").textContent=e.message}
  });
  updateLocationOptions();updateManualLocations();
 }catch(e){$("resourceOverview").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}
async function loadCabins(){try{const j=await json("/api/v5/resources");resourceCache=j.items||[];updateLocationOptions()}catch(e){console.error(e)}}
function cabinResourceId(kind){
 const location=$("trLocation").value,base=kind==="home"?"Heimkabine":"Gastkabine";
 return resourceCache.find(x=>x.location_id===location&&x.resource_type==="cabin"&&x.base_name===base)?.id||null;
}
$("trLocation").addEventListener("change",()=>{$("trCabin1").value="";$("trCabin2").value="";updateBaseOptions()});
$("trBase").addEventListener("change",updateTrainingModeOptions);


function fillManualTeams(){
 const current=$("manualTeam")?.value||"";
 if(!$("manualTeam"))return;
 $("manualTeam").innerHTML='<option value="">– keine –</option>'+manualTeamCache.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
 if(manualTeamCache.some(x=>x.id===current))$("manualTeam").value=current;
}
function manualWholePitches(){return resourceCache.filter(x=>x.resource_type==="pitch"&&x.section==="whole")}
function manualPitch(){return manualWholePitches().find(x=>x.location_id===$("manualLocation").value&&x.base_name===$("manualBase").value)}
function updateManualModes(){
 const p=manualPitch(),n=Number(p?.division_count||1),selected=$("manualMode").value;
 const opts=n===1?[["exclusive","Gesamt – nicht teilbar"]]:n===3?[["one_third","1/3"],["two_thirds","2/3"],["exclusive","Gesamt (3/3)"]]:
 [["flexible","Flexibel – automatisch A/B"],["half_a","Hälfte A"],["half_b","Hälfte B"],["exclusive","Gesamt exklusiv"]];
 $("manualMode").innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
 if(opts.some(([v])=>v===selected))$("manualMode").value=selected;
}
function updateManualBases(){
 const loc=$("manualLocation").value,selected=$("manualBase").value,bases=manualWholePitches().filter(x=>x.location_id===loc);
 $("manualBase").innerHTML=bases.map(x=>`<option value="${esc(x.base_name)}">${esc(x.base_name)}</option>`).join("");
 if(bases.some(x=>x.base_name===selected))$("manualBase").value=selected;updateManualModes();
}
function updateManualLocations(){
 const selected=$("manualLocation").value,locs=[];
 for(const p of manualWholePitches())if(!locs.some(x=>x.id===p.location_id))locs.push({id:p.location_id,name:p.location_name});
 $("manualLocation").innerHTML=locs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
 if(locs.some(x=>x.id===selected))$("manualLocation").value=selected;updateManualBases();
}
$("manualLocation").addEventListener("change",updateManualBases);$("manualBase").addEventListener("change",updateManualModes);

function openManualDialog(date){
 editingManualId="";$("manualDialogTitle").textContent="Manuellen Termin eintragen";fillManualTeams();updateManualLocations();
 $("manualType").value="Turnier";$("manualTitle").value="";$("manualTeam").value="";$("manualDate").value=date||"";
 $("manualStart").value="08:00";$("manualEnd").value="17:00";$("manualNote").value="";$("manualMsg").textContent="";
 $("deleteManual").classList.add("hidden");$("manualDialog").classList.remove("hidden");
}
async function editManualDialog(id){
 try{
  const {item:x}=await json("/api/v5/events/manual/"+id);editingManualId=id;fillManualTeams();updateManualLocations();
  $("manualDialogTitle").textContent="Manuellen Termin bearbeiten";$("manualType").value=x.competition||"Sonstiges";
  $("manualTitle").value=x.title||"";$("manualTeam").value=x.team_id||"";$("manualDate").value=fmtDateInput(x.event_date);
  $("manualStart").value=String(x.start_time||"").slice(0,5);$("manualEnd").value=String(x.end_time||"").slice(0,5);
  $("manualLocation").value=x.location_id||"";updateManualBases();$("manualBase").value=x.pitch_base||"";updateManualModes();
  $("manualMode").value=x.allocation_mode||"exclusive";$("manualNote").value=x.note||"";$("manualMsg").textContent="";
  $("deleteManual").classList.remove("hidden");$("manualDialog").classList.remove("hidden");
 }catch(e){alert(e.message)}
}
$("closeManual").onclick=()=>{$("manualDialog").classList.add("hidden");editingManualId=""};
$("saveManual").onclick=async()=>{try{
 const body={manualType:$("manualType").value,title:$("manualTitle").value,teamId:$("manualTeam").value||null,date:$("manualDate").value,
 start:$("manualStart").value,end:$("manualEnd").value,locationId:$("manualLocation").value,baseName:$("manualBase").value,
 allocationMode:$("manualMode").value,note:$("manualNote").value};
 await json(editingManualId?"/api/v5/events/manual/"+editingManualId:"/api/v5/events/manual",
 {method:editingManualId?"PUT":"POST",headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify(body)});
 $("manualDialog").classList.add("hidden");editingManualId="";await Promise.all([loadWeek(),loadMonth(),loadDashboard()]);
}catch(e){$("manualMsg").textContent=e.message}};
$("deleteManual").onclick=async()=>{if(!editingManualId||!confirm("Manuellen Termin wirklich löschen?"))return;try{
 await json("/api/v5/events/manual/"+editingManualId,{method:"DELETE",headers:{"x-edit-pin":pin}});
 $("manualDialog").classList.add("hidden");editingManualId="";await Promise.all([loadWeek(),loadMonth(),loadDashboard()]);
}catch(e){$("manualMsg").textContent=e.message}};

function clearTrainingForm(){
 editingTrainingId="";
 $("saveTraining").textContent="Training speichern";
 $("cancelEdit").classList.add("hidden");
 $("editOccurrenceHint").classList.add("hidden");
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
  const singleRadio=document.querySelector('input[name="trainingMode"][value="single"]');
  if(singleRadio)singleRadio.checked=true;
  syncTrainingModeUI();
  $("trTeam").value=x.team_id;
  $("trDate").value=fmtDateInput(x.event_date);
  $("trStart").value=String(x.start_time||"").slice(0,5);
  $("trEnd").value=String(x.end_time||"").slice(0,5);
  $("trLocation").value=x.location_id;
  $("trBase").value=x.pitch_base||"Hauptplatz";
  $("trMode").value=x.allocation_mode||"flexible";
  $("trNote").value=x.note||"";
  await loadCabins();
  $("trCabin1").value=x.home_cabin_id?"yes":"";
  $("trCabin2").value=x.guest_cabin_id?"yes":"";
  $("saveTraining").textContent=x.series_id?"Nur diese Einheit speichern":"Änderungen speichern";
  $("cancelEdit").classList.remove("hidden");
  $("editOccurrenceHint").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
 }catch(e){alert(e.message)}
}
function fmtDateInput(v){return String(v||"").slice(0,10)}


function syncTrainingModeUI(){
 const checked=document.querySelector('input[name="trainingMode"]:checked');
 trainingMode=checked?checked.value:"single";
 $("seriesFields").classList.toggle("hidden",trainingMode!=="series");
 $("singleDateField").classList.toggle("hidden",trainingMode==="series");
 $("singleDateField").style.display=trainingMode==="series"?"none":"";
 $("saveTraining").textContent=trainingMode==="series"?"Trainingsserie speichern":"Training speichern";
}
document.querySelectorAll('input[name="trainingMode"]').forEach(r=>r.addEventListener("change",syncTrainingModeUI));
$("seriesRecurrence").addEventListener("change",()=>$("monthOrdinalField").classList.toggle("hidden",$("seriesRecurrence").value!=="monthly"));
async function loadSeries(){
 try{
  const j=await json("/api/v5/training-series"),names={weekly:"wöchentlich",biweekly:"alle 2 Wochen",monthly:"monatlich"},days={1:"Mo",2:"Di",3:"Mi",4:"Do",5:"Fr",6:"Sa",7:"So"};
  $("seriesList").innerHTML=(j.items||[]).length?`<table><thead><tr><th>Mannschaft</th><th>Rhythmus</th><th>Tag</th><th>Zeitraum</th><th>Zeit</th><th>Ort</th><th>Platz</th><th></th></tr></thead><tbody>${j.items.map(x=>`<tr><td>${esc(x.team)}</td><td>${esc(names[x.recurrence_type])}</td><td>${days[x.weekday]}</td><td>${fmtDate(x.start_date)} – ${x.end_date?fmtDate(x.end_date):"offen"}</td><td>${String(x.start_time).slice(0,5)}–${String(x.end_time).slice(0,5)}</td><td>${esc(x.location)}</td><td>${esc(x.base_name)}</td><td><button class="delSeries" data-id="${x.id}" ${pin?"":"disabled"}>Serie löschen</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">Noch keine Trainingsserien angelegt.</div>`;
  document.querySelectorAll(".delSeries").forEach(b=>b.onclick=async()=>{if(!confirm("Komplette Serie und alle erzeugten Termine löschen?"))return;await json("/api/v5/training-series/"+b.dataset.id,{method:"DELETE",headers:{"x-edit-pin":pin}});await Promise.all([loadSeries(),loadTrainings(),loadWeek(),loadMonth(),loadDashboard()])});
 }catch(e){$("seriesList").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}

async function loadTrainings(){
 try{
  const to=addDays(weekStart,6);
  const [tj,wj]=await Promise.all([json(`/api/v5/trainings?from=${weekStart}&to=${to}`),json(`/api/v5/planner/week?start=${weekStart}`)]);
  const allocationById=new Map();
  for(const d of (wj.dayItems||[])){
    for(const i of (d.items||[])){
      if(i.eventType!=="training")continue;
      if(!allocationById.has(i.id))allocationById.set(i.id,[]);
      allocationById.get(i.id).push({start:i.start,end:i.end,section:i.section,sectionLabel:i.sectionLabel});
    }
  }
  const items=tj.items||[],conflictById=new Map();
  for(const c of wj.conflicts||[])for(const item of c.items||[]){
   if(item.eventType!=="training")continue;
   const others=(c.items||[]).filter(o=>o.id!==item.id).map(o=>`${o.eventType==="home_match"?"Spiel":"Training"} ${o.label}`).join(", ");
   conflictById.set(item.id,`${c.start}–${c.end}: ${c.reason}${others?` – ${others}`:""}`);
  }
  $("trainingList").innerHTML=items.length?`<table><thead><tr><th>Datum</th><th>Zeit</th><th>Mannschaft</th><th>Ort</th><th>Platz</th><th>Modus</th><th>Effektive Belegung</th><th>Kabinen</th><th>Konflikt</th><th></th></tr></thead><tbody>${items.map(x=>{
   const conflict=conflictById.get(x.id)||"";
   return `<tr class="${conflict?"conflictRow":""}"><td>${fmtDate(x.event_date)}</td><td>${String(x.start_time).slice(0,5)}–${String(x.end_time).slice(0,5)}</td><td>${esc(x.team)}</td><td>${esc(x.location)}</td><td>${esc(x.base_name)}</td><td>${esc(({flexible:"flexibel",half_a:"Hälfte A",half_b:"Hälfte B",exclusive:"Gesamt exklusiv"}[x.allocation_mode]||x.allocation_mode))}</td><td>${(()=>{
      const a=allocationById.get(x.id)||[];
      if(!a.length)return "–";
      return a.map(v=>`${v.start}–${v.end}: ${v.sectionLabel}`).join(" · ");
    })()}</td><td>${esc([x.cabin1_label,x.cabin2_label].filter(Boolean).join(" + ")||"–")}</td><td>${conflict?`<span class="conflictPill">Konflikt</span><br>${esc(conflict)}`:"–"}</td><td><div class="toolbar"><button class="editTr" data-id="${x.id}" ${pin?"":"disabled"}>Bearbeiten</button><button class="delTr" data-id="${x.id}" ${pin?"":"disabled"}>Löschen</button></div></td></tr>`;
  }).join("")}</tbody></table>`:`<div class="empty">In dieser Woche sind noch keine Trainings eingetragen.</div>`;
  document.querySelectorAll(".editTr").forEach(b=>b.onclick=()=>editTrainingForm(b.dataset.id));
  document.querySelectorAll(".delTr").forEach(b=>b.onclick=async()=>{if(!confirm("Training löschen?"))return;try{await json("/api/v5/trainings/"+b.dataset.id,{method:"DELETE",headers:{"x-edit-pin":pin}});await loadTrainings();await loadWeek();await loadMonth();await loadDashboard()}catch(e){alert(e.message)}})
 }catch(e){$("trainingList").innerHTML=`<div class="errorBox">${esc(e.message)}</div>`}
}
$("addPlace").onclick=async()=>{try{
 const body={name:$("newPlaceName").value.trim(),baseName:$("newPlaceBase").value.trim(),address:$("newPlaceAddress").value.trim(),
   divisionCount:Number($("newPlaceDivision").value),color:$("newPlaceColor").value};
 await json("/api/v5/resources/places",{method:"POST",headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify(body)});
 $("newPlaceName").value="";$("newPlaceAddress").value="";$("placeMsg").textContent="Trainingsort hinzugefügt.";
 await loadResources();
}catch(e){$("placeMsg").textContent=e.message}};

$("saveTraining").onclick=async()=>{try{
 const selectedMode=document.querySelector('input[name="trainingMode"]:checked')?.value||"single";
 trainingMode=selectedMode;
 const common={teamId:$("trTeam").value,start:$("trStart").value,end:$("trEnd").value,locationId:$("trLocation").value,baseName:$("trBase").value,allocationMode:$("trMode").value,cabin1Id:$("trCabin1").value==="yes"?cabinResourceId("home"):null,cabin2Id:$("trCabin2").value==="yes"?cabinResourceId("guest"):null,note:$("trNote").value};

 if(selectedMode==="series"&&!editingTrainingId){
   const body={...common,
     recurrenceType:$("seriesRecurrence").value,
     weekday:Number($("seriesWeekday").value),
     monthOrdinal:$("seriesMonthOrdinal").value,
     startDate:$("seriesStartDate").value,
     endDate:$("seriesEndDate").value||null
   };
   if(!body.startDate)throw new Error("Startdatum fehlt");
   if(body.endDate&&body.endDate<body.startDate)throw new Error("Enddatum liegt vor dem Startdatum");
   const result=await json("/api/v5/training-series",{method:"POST",headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify(body)});
   $("trainingMsg").textContent=`Trainingsserie gespeichert – ${result.created} Termine angelegt.`;
   const first=(result.dates||[])[0]||body.startDate;
   const d=new Date(first+"T12:00:00Z"),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);weekStart=d.toISOString().slice(0,10);monthValue=first.slice(0,7);
   await loadSeries();
 }else{
   const body={...common,date:$("trDate").value};
   const url=editingTrainingId?"/api/v5/trainings/"+editingTrainingId:"/api/v5/trainings";
   const method=editingTrainingId?"PUT":"POST";
   await json(url,{method,headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify(body)});
   $("trainingMsg").textContent=editingTrainingId?"Training aktualisiert.":"Training gespeichert.";
   clearTrainingForm();
   const d=new Date(body.date+"T12:00:00Z"),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);weekStart=d.toISOString().slice(0,10);monthValue=body.date.slice(0,7);
 }
 await loadTrainings();await loadWeek();await loadMonth();await loadDashboard()
}catch(e){$("trainingMsg").textContent=e.message}};

async function editGameForm(id){
 try{
  const j=await json("/api/v5/events/"+id),x=j.item;
  editingGameId=id;
  $("gameLabel").value=`${x.team||""} – ${x.opponent||""}`;
  $("gameDate").value=fmtDateInput(x.event_date);
  $("gameKickoff").value=String(x.kickoff_time||x.start_time||"").slice(0,5);
  $("gameLocation").value=x.location_id||"gemmingen";
  $("gameBase").value=x.pitch_base||"Hauptplatz";
  $("gameEditMsg").textContent="";
  $("gameEditPanel").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
 }catch(e){alert(e.message)}
}
$("cancelGameEdit").onclick=()=>{editingGameId="";$("gameEditPanel").classList.add("hidden");$("gameEditMsg").textContent=""};
$("saveGame").onclick=async()=>{try{
 if(!editingGameId)throw new Error("Kein Spiel ausgewählt");
 const body={date:$("gameDate").value,kickoff:$("gameKickoff").value,locationId:$("gameLocation").value,baseName:$("gameBase").value};
 await json("/api/v5/events/"+editingGameId,{method:"PUT",headers:{"content-type":"application/json","x-edit-pin":pin},body:JSON.stringify(body)});
 $("gameEditMsg").textContent="Spiel manuell aktualisiert. Beim nächsten FUSSBALL.DE-Sync wird der offizielle Stand erneut geprüft.";
 await Promise.all([loadGames(),loadWeek(),loadMonth(),loadDashboard()]);
}catch(e){$("gameEditMsg").textContent=e.message}};

$("resetGames").onclick=async()=>{
 if(!confirm("Wirklich ALLE aus FUSSBALL.DE importierten Spiele aus ClubPlanner löschen? Trainings und Trainingsserien bleiben erhalten."))return;
 if(!confirm("Letzte Bestätigung: Alle importierten Spiele werden gelöscht. Danach bitte FUSSBALL.DE neu synchronisieren."))return;
 try{
  const j=await json("/api/v5/events/all",{method:"DELETE",headers:{"x-edit-pin":pin}});
  alert(`${j.deleted||0} Spiele gelöscht. Jetzt FUSSBALL.DE synchronisieren.`);
  await Promise.all([loadGames(),loadWeek(),loadMonth(),loadDashboard()]);
 }catch(e){alert(e.message)}
};


function printRangeFromPreset(){
 const preset=$("printPreset").value;
 const [y,m]=monthValue.split("-").map(Number);
 if(preset==="month"){
  $("printFrom").value=`${monthValue}-01`;
  $("printTo").value=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 }else if(preset==="hinrunde"){
  $("printFrom").value=`${y}-07-01`;
  $("printTo").value=`${y}-12-31`;
 }else if(preset==="rueckrunde"){
  const ry=m>=7?y+1:y;$("printFrom").value=`${ry}-01-01`;$("printTo").value=`${ry}-06-01`;
 }else if(preset==="custom"){
  // Bei freiem Zeitraum bleiben die aktuell eingetragenen Werte erhalten.
  if(!$("printFrom").value)$("printFrom").value=`${monthValue}-01`;
  if(!$("printTo").value)$("printTo").value=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 }
}
function syncPrintScaleLabel(){$("printScaleLabel").textContent=$("printScale").value+"%"}
$("printCalendar").onclick=()=>{$("printDialog").classList.remove("hidden");printRangeFromPreset();syncPrintScaleLabel()};
$("closePrint").onclick=()=>$("printDialog").classList.add("hidden");
$("printPreset").onchange=printRangeFromPreset;
$("printFrom").addEventListener("change",()=>{$("printPreset").value="custom"});
$("printTo").addEventListener("change",()=>{$("printPreset").value="custom"});
$("printScale").addEventListener("input",syncPrintScaleLabel);

function monthsBetween(from,to){
 const a=from.slice(0,7),b=to.slice(0,7),out=[];let x=a;
 while(x<=b&&out.length<18){out.push(x);x=monthShift(x,1)}return out;
}
function printEsc(s){return esc(s)}
async function buildPrintMonth(ym,from,to){
 const j=await json("/api/v5/planner/month?month="+encodeURIComponent(ym));
 const [yy,mm]=ym.split("-").map(Number);
 const firstDow=(new Date(Date.UTC(yy,mm-1,1)).getUTCDay()+6)%7;
 const daysInMonth=new Date(Date.UTC(yy,mm,0)).getUTCDate();
 const weekRows=Math.ceil((firstDow+daysInMonth)/7);
 const cells=[];
 for(let i=0;i<firstDow;i++)cells.push('<div class="pday blank"></div>');
 for(const d of j.days){
  if(d.date<from||d.date>to){
   cells.push(`<div class="pday mutedday"><b>${Number(d.date.slice(-2))}</b></div>`);
   continue;
  }
  const entries=[];
  for(const g of d.groups)for(const s of g.segments){
   const labels=s.items.map(i=>`${i.eventType==="home_match"?"SPIEL":(i.eventType==="manual_event"?"TERMIN":"Training")}: ${i.label}${i.sectionLabel!=="Gesamt"?` (${i.sectionLabel})`:""}`).join(" / ");
   const manual=s.items.some(i=>i.manuallyChanged);
   const color=printEsc(g.color||"#f5f7f9");
   entries.push(`<div class="pitem ${s.conflict?"conflict":""}" style="--item-color:${color};background:${color};border-left-color:${color}">
     <b>${printEsc(g.location)} · ${printEsc(g.baseName)}</b><br>
     <strong>${s.start}–${s.end}</strong><br>
     ${printEsc(labels)}${manual?' <span class="pmanual">MANUELL</span>':""}${s.conflict?'<br><b class="pred">KONFLIKT</b>':""}
   </div>`);
  }
  cells.push(`<div class="pday ${entries.length>=3?"crowded":""}"><div class="pnum">${Number(d.date.slice(-2))}</div>${entries.join("")}</div>`);
 }
 while(cells.length<weekRows*7)cells.push('<div class="pday blank"></div>');
 const scale=Number($("printScale").value||85)/100; return `<section class="printPage weeks${weekRows}" style="--content-scale:${scale}">
   <header><h1>ClubPlanner · Platzbelegung</h1><div>${printEsc(monthName(ym))}</div></header>
   <div class="pgrid weeks${weekRows}">
    ${["Mo","Di","Mi","Do","Fr","Sa","So"].map(x=>`<div class="pdow">${x}</div>`).join("")}${cells.join("")}
   </div>
   <footer>SV Gemmingen · erstellt ${new Date().toLocaleDateString("de-DE")}</footer>
 </section>`;
}
$("startPrint").onclick=async()=>{
 const from=$("printFrom").value,to=$("printTo").value;
 if(!from||!to||from>to){alert("Bitte einen gültigen Zeitraum auswählen.");return}
 const months=monthsBetween(from,to);if(!months.length){alert("Zeitraum ungültig.");return}
 $("startPrint").disabled=true;
 try{
  const pages=[];for(const ym of months)pages.push(await buildPrintMonth(ym,from,to));
  const w=window.open("","_blank");if(!w)throw new Error("Druckfenster wurde vom Browser blockiert.");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ClubPlanner_${from}_${to}</title><style>
   @page{size:A4 landscape;margin:5mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#14202b;background:#fff}
.printPage{
 width:287mm;height:200mm;max-height:200mm;overflow:hidden;position:relative;
 break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid;
 padding:0;margin:0 auto;background:#fff
}
.printPage:last-child{break-after:auto;page-break-after:auto}
header{height:11mm;display:flex;justify-content:space-between;align-items:center;border-bottom:1.2mm solid #1f4e78;margin:0 0 2mm;padding:0 1mm}
h1{font-size:14pt;margin:0}header div{font-size:12pt;font-weight:700}
.pgrid{height:178mm;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1mm;align-content:stretch}
.pgrid.weeks4{grid-template-rows:5mm repeat(4,41.75mm)}
.pgrid.weeks5{grid-template-rows:5mm repeat(5,33.4mm)}
.pgrid.weeks6{grid-template-rows:5mm repeat(6,27.83mm)}
.pdow{text-align:center;font-weight:800;font-size:7.5pt;padding:.8mm 0;overflow:hidden}
.pday{
 border:.35mm solid #aebdcb;padding:calc(1mm * var(--content-scale,0.85));font-size:calc(6.4pt * var(--content-scale,0.85));line-height:1.12;overflow:hidden;
 background:#fff;min-width:0;min-height:0
}
.pday.blank,.pday.mutedday{background:#f5f6f7!important}
.pnum{font-weight:800;font-size:calc(7.2pt * var(--content-scale,0.85));margin-bottom:calc(.7mm * var(--content-scale,0.85))}
.pitem{
 border-left:1.1mm solid var(--item-color,#607d94);border-radius:1.2mm;padding:calc(.8mm * var(--content-scale,0.85));margin:calc(.4mm * var(--content-scale,0.85)) 0;
 line-height:1.08;font-size:inherit;overflow:hidden;background:var(--item-color,#f5f7f9)!important;
 -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important
}
.pday.crowded .pitem{margin-top:.15mm;margin-bottom:.15mm;line-height:1.02}.pitem.conflict{background:#ffeaea!important;border-left-color:#c62828!important}
.pmanual{display:inline-block;font-weight:800;border:.25mm solid #b68b00;border-radius:5mm;padding:0 calc(.8mm * var(--content-scale,0.85));background:#fff3cd!important}
.pred{color:#b42318}
footer{height:4mm;display:flex;justify-content:flex-end;align-items:end;font-size:6.2pt;color:#66727e;padding-right:1mm}
@media print{
 html,body{width:297mm;height:auto}
 .printPage{margin:0!important}
}
  </style></head><body>${pages.join("")}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  w.document.close();$("printDialog").classList.add("hidden");
 }catch(e){alert(e.message)}finally{$("startPrint").disabled=false}
};

async function loadGames(){const j=await json("/api/v5/events"+(includePast?"?includePast=1":"")),e=j.events||[];$("count").textContent=e.length;$("times").textContent=e.filter(x=>x.kickoff_time).length;$("venues").textContent=e.filter(x=>x.location).length;$("cancelled").textContent=e.filter(x=>x.status==="cancelled").length;$("rows").innerHTML=e.map(x=>`<tr class="${x.status==="cancelled"?"cancelled":""} trainingClick" data-game-id="${esc(x.id)}" title="Spiel bearbeiten"><td>${fmtDate(x.event_date)}</td><td>${esc((x.kickoff_time||"").slice(0,5))}</td><td>${esc(x.team)}</td><td>${esc(x.opponent)}</td><td>${esc(x.competition)}</td><td>${esc(x.status==="cancelled"?"abgesetzt":x.location||"")}</td><td>${esc(x.resource||"")}</td><td>${esc(x.address)}</td><td>${x.manually_changed?'<span class="manualBadge">MANUELL</span>':""}</td><td>${esc(fmtStatus(x.status))}</td></tr>`).join("")}
$("past").onclick=async()=>{includePast=!includePast;$("past").textContent=includePast?"Vergangene Spiele ausblenden":"Vergangene Spiele anzeigen";await loadGames()};
$("sync").onclick=async()=>{if(!confirm("FUSSBALL.DE jetzt synchronisieren?"))return;try{await json("/api/v5/sync/fussballde",{method:"POST",headers:{"x-edit-pin":pin}});$("sync").disabled=true;poll()}catch(e){alert(e.message)}};
async function poll(){try{const s=await json("/api/v5/sync/status");$("syncState").textContent=s.running?`${s.progress} (${s.processed}/${s.total||"?"})`:s.progress;if(s.running){clearTimeout(timer);timer=setTimeout(poll,1000)}else{$("sync").disabled=!pin;await loadGames();await loadWeek();await loadMonth();await loadDashboard()}}catch(e){$("syncState").textContent=e.message}}

(async()=>{try{await bootstrapToday();syncTrainingModeUI();await Promise.all([check(),loadTeams(),loadGames(),loadResources()]);await loadCabins();await loadSeries();await loadDashboard();await loadWeek();await loadMonth();poll()}catch(e){console.error(e);alert("Startfehler: "+e.message)}})();
