
import express from "express";
import ExcelJS from "exceljs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"3mb"}));
app.use(express.static(path.join(__dirname,"public")));

const PORT = process.env.PORT || 10000;
const EDIT_PIN = process.env.EDIT_PIN || "1234";
const DATABASE_URL = process.env.DATABASE_URL;
const FUSSBALL_CLUB_ID = process.env.FUSSBALL_CLUB_ID || "00ES8GN9B8000051VV0AG08LVUPGND5I";
const MIN_GAP_MINUTES = Number(process.env.MIN_GAP_MINUTES || 180);

if(!DATABASE_URL){ console.error("DATABASE_URL fehlt."); process.exit(1); }

const pool = new Pool({
  connectionString:DATABASE_URL,
  ssl:{rejectUnauthorized:false},
  max:5, idleTimeoutMillis:30000, connectionTimeoutMillis:15000
});
const db=(q,p=[])=>pool.query(q,p);

const DEFAULT_TEAMS=["Herren I","Herren II","Frauen","A-Junioren","B-Junioren","C1-Junioren","C2-Junioren","D-Junioren"];

const syncState = {
  running:false,
  progress:"Noch nicht synchronisiert",
  total:0,
  processed:0,
  imported:0,
  updated:0,
  skipped:0,
  error:null,
  startedAt:null,
  finishedAt:null
};

async function initDb(){
  await db(`create table if not exists clubplanner_teams(
    id uuid primary key,
    name text not null unique,
    coach text default '',
    contact text default '',
    note text default '',
    active boolean not null default true,
    created_at timestamptz not null default now()
  )`);
  await db(`alter table clubplanner_teams add column if not exists coach text default ''`);
  await db(`alter table clubplanner_teams add column if not exists contact text default ''`);
  await db(`alter table clubplanner_teams add column if not exists note text default ''`);
  await db(`alter table clubplanner_teams add column if not exists active boolean not null default true`);

  await db(`create table if not exists clubplanner_locations(
    id text primary key, name text not null unique, address text default '', active boolean not null default true
  )`);

  await db(`create table if not exists clubplanner_resources(
    id uuid primary key,
    location_id text not null references clubplanner_locations(id) on delete cascade,
    resource_type text not null check(resource_type in ('pitch','cabin')),
    name text not null, active boolean not null default true,
    unique(location_id,resource_type,name)
  )`);

  await db(`create table if not exists clubplanner_events(
    id uuid primary key,
    event_date date not null,
    start_time time not null,
    end_time time not null,
    event_type text not null,
    team text not null,
    opponent text default '',
    competition text default '',
    location text not null,
    address text default '',
    pitch text default '',
    home_cabin text default '',
    guest_cabin text default '',
    status text default 'geplant',
    note text default '',
    source text default 'manual',
    series_id uuid,
    external_id text,
    external_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  for(const alter of [
    `alter table clubplanner_events add column if not exists series_id uuid`,
    `alter table clubplanner_events add column if not exists competition text default ''`,
    `alter table clubplanner_events add column if not exists address text default ''`
  ]) await db(alter);

  await db(`create index if not exists idx_cp_events_date on clubplanner_events(event_date)`);
  await db(`create unique index if not exists uq_cp_external on clubplanner_events(source,external_id) where external_id is not null`);

  await db(`insert into clubplanner_locations(id,name,address) values
    ('gemmingen','Gemmingen','Beim Sportplatz 3, 75050 Gemmingen'),
    ('stebbach','Stebbach','Jahnweg 1, 75050 Gemmingen-Stebbach')
    on conflict(id) do update set name=excluded.name,address=excluded.address`);

  for(const loc of ["gemmingen","stebbach"]){
    for(const name of ["Hauptplatz","Trainingsplatz"]){
      await db(`insert into clubplanner_resources(id,location_id,resource_type,name)
        values($1,$2,'pitch',$3) on conflict(location_id,resource_type,name) do nothing`,
        [crypto.randomUUID(),loc,name]);
    }
    for(const name of ["Heimkabine","Gastkabine"]){
      await db(`insert into clubplanner_resources(id,location_id,resource_type,name)
        values($1,$2,'cabin',$3) on conflict(location_id,resource_type,name) do nothing`,
        [crypto.randomUUID(),loc,name]);
    }
  }

  for(const name of DEFAULT_TEAMS){
    await db(`insert into clubplanner_teams(id,name) values($1,$2) on conflict(name) do nothing`,[crypto.randomUUID(),name]);
  }
  console.log("Sprint 3 Datenbankstruktur ist bereit.");
}

function requirePin(req,res,next){
  if(req.headers["x-edit-pin"]!==EDIT_PIN) return res.status(401).json({error:"Bearbeitungs-PIN falsch"});
  next();
}
const tmin=t=>{const s=String(t||"").slice(0,5); if(!/^\d{2}:\d{2}$/.test(s))return null; const[a,b]=s.split(":").map(Number); return a*60+b};
const active=e=>!["abgesetzt","ausfall","abbruch"].includes(String(e.status||"").toLowerCase());
function overlap(a,b){
  if(a.date!==b.date)return false;
  const as=tmin(a.start),ae=tmin(a.end),bs=tmin(b.start),be=tmin(b.end);
  return ![as,ae,bs,be].some(x=>x===null) && as<be && bs<ae;
}
function conflicts(events){
  const out=[];
  for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
    const a=events[i],b=events[j]; if(!active(a)||!active(b)||!overlap(a,b))continue;
    const reasons=[];
    if(a.location===b.location && a.pitch && b.pitch && a.pitch===b.pitch)reasons.push(`Platz: ${a.pitch}`);
    if(a.location===b.location){
      const ac=[a.homeCabin,a.guestCabin].filter(Boolean),bc=[b.homeCabin,b.guestCabin].filter(Boolean);
      for(const c of ac)if(bc.includes(c))reasons.push(`Kabine: ${c}`);
    }
    if(reasons.length)out.push({a:a.id,b:b.id,reasons:[...new Set(reasons)]});
  }
  return out;
}
function mapEvent(r){
  return {
    id:r.id,
    date:r.event_date instanceof Date?r.event_date.toISOString().slice(0,10):String(r.event_date).slice(0,10),
    start:String(r.start_time||"").slice(0,5),end:String(r.end_time||"").slice(0,5),
    type:r.event_type,team:r.team,opponent:r.opponent||"",competition:r.competition||"",
    location:r.location,address:r.address||"",pitch:r.pitch||"",
    homeCabin:r.home_cabin||"",guestCabin:r.guest_cabin||"",status:r.status||"geplant",
    note:r.note||"",source:r.source||"manual",seriesId:r.series_id||null,
    externalId:r.external_id||null,externalUrl:r.external_url||null
  };
}
async function allData(){
  const [t,l,r,e]=await Promise.all([
    db(`select * from clubplanner_teams order by active desc,name`),
    db(`select * from clubplanner_locations where active=true order by name`),
    db(`select * from clubplanner_resources where active=true order by location_id,resource_type,name`),
    db(`select * from clubplanner_events order by event_date,start_time,team`)
  ]);
  const events=e.rows.map(mapEvent);
  return {club:{name:"SV Gemmingen / SG Stebbach-Gemmingen"},teams:t.rows,locations:l.rows,resources:r.rows,events,conflicts:conflicts(events)};
}

function datePlusMinutes(date,time,mins){
  const [y,m,d]=date.split("-").map(Number), [hh,mm]=String(time||"00:00").split(":").map(Number);
  const x=new Date(Date.UTC(y,m-1,d,hh,mm)); x.setUTCMinutes(x.getUTCMinutes()+mins);
  return `${String(x.getUTCHours()).padStart(2,"0")}:${String(x.getUTCMinutes()).padStart(2,"0")}`;
}
function clean(s){return String(s||"").replace(/[\u200b\u200c\u200d\u2060]/g," ").replace(/\s+/g," ").trim()}
function parseDeDate(s){const m=String(s||"").match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null}
function inferLocation(text){
  const s=String(text||"");
  if(/Stebbach|Jahnweg/i.test(s))return {location:"Stebbach",address:"Jahnweg 1, 75050 Gemmingen-Stebbach"};
  if(/Gemmingen|Beim Sportplatz/i.test(s))return {location:"Gemmingen",address:"Beim Sportplatz 3, 75050 Gemmingen"};
  return {location:"",address:""};
}
function inferPitch(text){
  const s=String(text||"");
  if(/Kunstrasen/i.test(s))return "Trainingsplatz";
  if(/Rasen|Hauptplatz/i.test(s))return "Hauptplatz";
  return "";
}

async function collectGameLinks(page){
  const printUrl=`https://www.fussball.de/vereinsspielplan.druck/-/datum-bis/2027-06-30/datum-von/2026-08-07/id/${FUSSBALL_CLUB_ID}/match-type/-1/max/999/mode/PRINT/show-venues/true`;
  syncState.progress="Lade kompletten Vereinsspielplan …";
  await page.goto(printUrl,{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForTimeout(1200);
  let links=await page.locator('a[href*="/spiel/"]').evaluateAll(as=>[...new Set(as.map(a=>(a.href||"").split("?")[0]).filter(Boolean))]);
  if(links.length>=3)return links;

  const dynamic=`https://www.fussball.de/ajax.club.matchplan/-/id/${FUSSBALL_CLUB_ID}/mode/PAGE/show-filter/true`;
  await page.goto(dynamic,{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForTimeout(1200);
  for(let round=0;round<40;round++){
    const before=await page.locator('a[href*="/spiel/"]').count();
    const clicked=await page.evaluate(()=>{
      const e=[...document.querySelectorAll("button,a,div,span")].find(x=>(x.innerText||x.textContent||"").trim()==="Mehr laden"&&x.offsetParent!==null);
      if(!e)return false; e.click(); return true;
    });
    if(!clicked)break;
    await page.waitForTimeout(1000);
    const after=await page.locator('a[href*="/spiel/"]').count();
    if(after<=before)break;
  }
  links=await page.locator('a[href*="/spiel/"]').evaluateAll(as=>[...new Set(as.map(a=>(a.href||"").split("?")[0]).filter(Boolean))]);
  return links;
}

async function parseGame(context,url,index,total){
  const page=await context.newPage();
  try{
    syncState.processed=index;
    syncState.progress=`Prüfe Spiel ${index} von ${total} …`;
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
    await page.waitForTimeout(500);
    const title=clean(await page.title());
    const body=clean(await page.locator("body").innerText().catch(()=>""));
    const m=title.match(/^(.*?)\s+-\s+(.*?)\s+Ergebnis:\s+(.*?)\s+-\s+(.*?)\s+-\s+(\d{2}\.\d{2}\.\d{4})/);
    if(!m)return null;

    const home=clean(m[1]), away=clean(m[2]), competition=clean(m[3]), date=parseDeDate(m[5]);
    if(!date || !/Gemmingen/i.test(home))return null;

    let status="geplant";
    if(/Absetzung|Spielabsetzung/i.test(body))status="abgesetzt";
    else if(/Ausfall|Spielausfall/i.test(body))status="ausfall";
    else if(/Abbruch|Spielabbruch/i.test(body))status="abbruch";
    else if(/Verlegung|verlegt/i.test(body))status="verlegt";

    let start="";
    const tm=body.match(/\b(\d{2}:\d{2})\s*Uhr\b/i);
    if(tm)start=tm[1];

    let venueText="";
    const maps=page.locator('a[href*="google"],a[href*="maps"]');
    for(let i=0,n=await maps.count();i<n;i++){
      const txt=clean(await maps.nth(i).innerText().catch(()=>""));
      if(/Gemmingen|Stebbach|Beim Sportplatz|Jahnweg/i.test(txt)){venueText=txt;break}
    }
    if(!venueText){
      const vm=body.match(/(.{0,180}(?:Beim Sportplatz|Jahnweg).{0,180}75050\s+Gemmingen(?:-Stebbach)?)/i);
      if(vm)venueText=clean(vm[1]);
    }

    const loc=inferLocation(venueText), pitch=inferPitch(venueText);
    const externalId=(url.match(/\/spiel\/([A-Z0-9]+)(?:\/|$)/i)||[])[1] || url;

    return {
      date,start,end:start?datePlusMinutes(date,start,120):"23:59",
      type:"Heimspiel",team:home,opponent:away,competition,
      location:loc.location||"PRÜFEN",address:loc.address,pitch,
      homeCabin:loc.location?"Heimkabine":"",guestCabin:loc.location?"Gastkabine":"",
      status,note:loc.location?"":"SPIELORT PRÜFEN",source:"fussball.de",
      externalId,externalUrl:url
    };
  }finally{await page.close().catch(()=>{})}
}

async function upsertImported(e){
  const found=await db(`select id from clubplanner_events where source='fussball.de' and external_id=$1`,[e.externalId]);
  if(found.rowCount){
    await db(`update clubplanner_events set
      event_date=$2,start_time=$3,end_time=$4,event_type=$5,team=$6,opponent=$7,competition=$8,
      location=$9,address=$10,pitch=$11,home_cabin=$12,guest_cabin=$13,status=$14,note=$15,
      external_url=$16,updated_at=now() where id=$1`,
      [found.rows[0].id,e.date,e.start||"00:00",e.end||"23:59",e.type,e.team,e.opponent,e.competition,
       e.location,e.address,e.pitch,e.homeCabin,e.guestCabin,e.status,e.note,e.externalUrl]);
    syncState.updated++;
  }else{
    await db(`insert into clubplanner_events(
      id,event_date,start_time,end_time,event_type,team,opponent,competition,location,address,pitch,
      home_cabin,guest_cabin,status,note,source,external_id,external_url
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'fussball.de',$16,$17)`,
      [crypto.randomUUID(),e.date,e.start||"00:00",e.end||"23:59",e.type,e.team,e.opponent,e.competition,
       e.location,e.address,e.pitch,e.homeCabin,e.guestCabin,e.status,e.note,e.externalId,e.externalUrl]);
    syncState.imported++;
  }
  await db(`insert into clubplanner_teams(id,name) values($1,$2) on conflict(name) do nothing`,[crypto.randomUUID(),e.team]);
}

async function runSync(){
  if(syncState.running)return;
  Object.assign(syncState,{running:true,progress:"Starte Browser …",total:0,processed:0,imported:0,updated:0,skipped:0,error:null,startedAt:new Date().toISOString(),finishedAt:null});
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
    const context=await browser.newContext({
      locale:"de-DE",timezoneId:"Europe/Berlin",viewport:{width:1400,height:1000},
      userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
    });
    const page=await context.newPage();
    const links=await collectGameLinks(page);
    syncState.total=links.length;
    if(links.length<3)throw new Error(`FUSSBALL.DE lieferte nur ${links.length} Spiel-Links.`);

    for(let i=0;i<links.length;i++){
      try{
        const game=await parseGame(context,links[i],i+1,links.length);
        if(!game){syncState.skipped++;continue}
        await upsertImported(game);
      }catch(e){
        console.error("Spiel konnte nicht importiert werden:",links[i],e.message);
        syncState.skipped++;
      }
    }
    syncState.progress=`Fertig: ${syncState.imported} neu · ${syncState.updated} aktualisiert · ${syncState.skipped} übersprungen`;
    syncState.finishedAt=new Date().toISOString();
  }catch(e){
    syncState.error=e.message;
    syncState.progress="Synchronisierung fehlgeschlagen";
  }finally{
    if(browser)await browser.close().catch(()=>{});
    syncState.running=false;
  }
}

app.get("/health",async(req,res)=>{try{await db("select 1");res.json({ok:true,database:"connected"})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.get("/api/db-status",async(req,res)=>{try{const q=await db(`select now() now,(select count(*) from clubplanner_teams) teams,(select count(*) from clubplanner_events) events,(select count(*) from clubplanner_resources) resources`);res.json({ok:true,...q.rows[0]})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post("/api/login",(req,res)=>res.json({ok:req.body?.pin===EDIT_PIN}));
app.get("/api/data",async(req,res)=>{try{res.json(await allData())}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/sync/status",(req,res)=>res.json(syncState));
app.post("/api/sync",requirePin,(req,res)=>{if(!syncState.running)runSync();res.status(202).json({ok:true,running:true})});

app.post("/api/check-conflicts",async(req,res)=>{
  try{
    const cand=req.body||{};
    const data=await allData();
    const fake={id:"preview",date:cand.date,start:cand.start,end:cand.end,type:cand.type,team:cand.team,location:cand.location,pitch:cand.pitch,homeCabin:cand.homeCabin||"",guestCabin:cand.guestCabin||"",status:cand.status||"geplant"};
    const c=conflicts([...data.events,fake]).filter(x=>x.a==="preview"||x.b==="preview");
    res.json({ok:true,conflicts:c});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});

async function insertEvent(e,id=crypto.randomUUID(),seriesId=null){
  await db(`insert into clubplanner_events(
    id,event_date,start_time,end_time,event_type,team,opponent,competition,location,address,pitch,
    home_cabin,guest_cabin,status,note,source,series_id
  ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'manual',$16)`,
  [id,e.date,e.start,e.end,e.type,e.team,e.opponent||"",e.competition||"",e.location,e.address||"",e.pitch||"",
   e.homeCabin||"",e.guestCabin||"",e.status||"geplant",e.note||"",seriesId]);
}
app.post("/api/events",requirePin,async(req,res)=>{
  try{
    const e=req.body||{}; if(!e.date||!e.start||!e.end||!e.team||!e.type||!e.location)return res.status(400).json({error:"Pflichtfelder fehlen"});
    const seriesId=e.repeatWeekly&&e.repeatUntil?crypto.randomUUID():null;let count=0;
    if(seriesId){let d=new Date(e.date+"T12:00:00"),until=new Date(e.repeatUntil+"T12:00:00");while(d<=until&&count<60){await insertEvent({...e,date:d.toISOString().slice(0,10)},crypto.randomUUID(),seriesId);d.setDate(d.getDate()+7);count++}}
    else{await insertEvent(e);count=1}
    res.json({ok:true,count,seriesId});
  }catch(e){res.status(500).json({error:e.message})}
});
app.delete("/api/events/:id",requirePin,async(req,res)=>{try{await db(`delete from clubplanner_events where id=$1`,[req.params.id]);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.delete("/api/series/:id",requirePin,async(req,res)=>{try{await db(`delete from clubplanner_events where series_id=$1`,[req.params.id]);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});

app.post("/api/teams",requirePin,async(req,res)=>{try{const x=req.body||{},name=String(x.name||"").trim();if(!name)return res.status(400).json({error:"Name fehlt"});await db(`insert into clubplanner_teams(id,name,coach,contact,note,active) values($1,$2,$3,$4,$5,true) on conflict(name) do update set coach=excluded.coach,contact=excluded.contact,note=excluded.note,active=true`,[crypto.randomUUID(),name,x.coach||"",x.contact||"",x.note||""]);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.put("/api/teams/:id",requirePin,async(req,res)=>{try{const x=req.body||{};await db(`update clubplanner_teams set name=$2,coach=$3,contact=$4,note=$5,active=$6 where id=$1`,[req.params.id,x.name,x.coach||"",x.contact||"",x.note||"",x.active!==false]);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.delete("/api/teams/:id",requirePin,async(req,res)=>{try{await db(`update clubplanner_teams set active=false where id=$1`,[req.params.id]);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});

app.post("/api/resources",requirePin,async(req,res)=>{try{const x=req.body||{};await db(`insert into clubplanner_resources(id,location_id,resource_type,name,active) values($1,$2,$3,$4,true) on conflict(location_id,resource_type,name) do update set active=true`,[crypto.randomUUID(),x.locationId,x.type,x.name]);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.delete("/api/resources/:id",requirePin,async(req,res)=>{try{await db(`update clubplanner_resources set active=false where id=$1`,[req.params.id]);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/export",async(req,res)=>{
  try{
    const d=await allData(),ids=new Set(d.conflicts.flatMap(x=>[x.a,x.b]));
    const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Belegungsplan",{views:[{state:"frozen",ySplit:1}]});
    ws.columns=[["Datum",13],["Von",9],["Bis",9],["Art",14],["Mannschaft",28],["Gegner / Info",28],["Wettbewerb",24],["Ort",16],["Adresse",38],["Platz",18],["Heimkabine",16],["Gastkabine",16],["Status",14],["Bemerkung",28],["Quelle",12]].map(([header,width])=>({header,width}));
    ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}};
    for(const e of d.events){const row=ws.addRow([e.date,e.start,e.end,e.type,e.team,e.opponent,e.competition,e.location,e.address,e.pitch,e.homeCabin,e.guestCabin,e.status,e.note,e.source]);if(ids.has(e.id))row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF4B084"}}}
    const buf=await wb.xlsx.writeBuffer();res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.setHeader("Content-Disposition",'attachment; filename="ClubPlanner_SV_Gemmingen.xlsx"');res.send(Buffer.from(buf));
  }catch(e){res.status(500).send(e.message)}
});

initDb().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log(`ClubPlanner Sprint 3 läuft auf Port ${PORT}`)))
.catch(e=>{console.error("DB-Startfehler",e);process.exit(1)});
