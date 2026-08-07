
import express from "express";
import ExcelJS from "exceljs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import * as cheerio from "cheerio";
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

const OFFICIAL_TEAMS=[
  "Herren - SG Stebbach/Gemmingen",
  "Herren - SG Stebbach/Gemmingen 2",
  "A-Junioren - JSG Gemmingen / Stebbach",
  "B-Junioren - JSG Gemmingen/Stebbach",
  "C-Junioren - JSG Gemmingen/Stebbach",
  "C-Junioren - JSG Gemmingen/Stebbach 2",
  "D-Junioren - JSG Gemmingen/Stebbach",
  "Frauen - SV Gemmingen"
];

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
  finishedAt:null,
  lastActivity:null
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
    `alter table clubplanner_events add column if not exists address text default ''`,
    `alter table clubplanner_events add column if not exists kickoff_known boolean not null default true`
  ]) await db(alter);

  await db(`update clubplanner_events set kickoff_known=false where source='fussball.de' and start_time='00:00:00'`);
  await db(`update clubplanner_events
    set home_cabin='', guest_cabin=''
    where source='fussball.de' and (coalesce(home_cabin,'')<>'' or coalesce(guest_cabin,'')<>'')`);
  await db(`create index if not exists idx_cp_events_date on clubplanner_events(event_date)`);
  await db(`create unique index if not exists uq_cp_external on clubplanner_events(source,external_id) where external_id is not null`);

  await db(`insert into clubplanner_locations(id,name,address) values
    ('gemmingen','Gemmingen','Beim Sportplatz 3, 75050 Gemmingen'),
    ('stebbach','Stebbach','Jahnweg 1, 75050 Gemmingen-Stebbach')
    on conflict(id) do update set name=excluded.name,address=excluded.address`);

  for(const loc of ["gemmingen","stebbach"]){
    for(const base of ["Hauptplatz","Trainingsplatz"]){
      for(const suffix of ["Gesamt","Hälfte A","Hälfte B"]){
        const name=`${base} – ${suffix}`;
        await db(`insert into clubplanner_resources(id,location_id,resource_type,name)
          values($1,$2,'pitch',$3) on conflict(location_id,resource_type,name) do update set active=true`,
          [crypto.randomUUID(),loc,name]);
      }
    }
    for(const name of ["Heimkabine","Gastkabine"]){
      await db(`insert into clubplanner_resources(id,location_id,resource_type,name)
        values($1,$2,'cabin',$3) on conflict(location_id,resource_type,name) do update set active=true`,
        [crypto.randomUUID(),loc,name]);
    }
    await db(`update clubplanner_resources set active=false
      where location_id=$1 and resource_type='pitch' and name in ('Hauptplatz','Trainingsplatz')`,[loc]);
  }

  for(const name of OFFICIAL_TEAMS){
    await db(`insert into clubplanner_teams(id,name) values($1,$2) on conflict(name) do nothing`,[crypto.randomUUID(),name]);
  }
  // Remove only the old template names from earlier sprints. User-created teams remain untouched.
  const obsolete=["Herren I","Herren II","Frauen","A-Junioren","B-Junioren","C1-Junioren","C2-Junioren","D-Junioren"];
  await db(`update clubplanner_teams set active=false where name = any($1::text[])`,[obsolete]);

  console.log("Sprint 3.5 Datenbankstruktur ist bereit.");
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
function pitchParts(name){
  const n=String(name||"").trim();
  if(!n)return null;
  const base=/^Trainingsplatz/i.test(n)?"Trainingsplatz":(/^Hauptplatz/i.test(n)?"Hauptplatz":n);
  let part="Gesamt";
  if(/Hälfte\s*A/i.test(n))part="A";
  else if(/Hälfte\s*B/i.test(n))part="B";
  return {base,part};
}
function pitchesConflict(aName,bName){
  const a=pitchParts(aName),b=pitchParts(bName);
  if(!a||!b||a.base!==b.base)return false;
  if(a.part==="Gesamt"||b.part==="Gesamt")return true;
  return a.part===b.part; // A+A conflict, B+B conflict, A+B allowed
}
function conflicts(events){
  const out=[];
  for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
    const a=events[i],b=events[j];
    if(!active(a)||!active(b)||!overlap(a,b))continue;
    const reasons=[];

    if(a.location===b.location && pitchesConflict(a.pitch,b.pitch)){
      reasons.push(`Platz: ${a.pitch} ↔ ${b.pitch}`);
    }

    // Kabinen only matter when actually assigned (normally training/manual events).
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
    externalId:r.external_id||null,externalUrl:r.external_url||null,kickoffKnown:r.kickoff_known!==false
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


function syncLog(message){
  syncState.progress=message;
  syncState.lastActivity=new Date().toISOString();
  console.log(`[FUSSBALL-SYNC] ${message}`);
}

async function fetchText(url, timeoutMs=15000){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const r=await fetch(url,{
      signal:ctrl.signal,
      redirect:"follow",
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept-language":"de-DE,de;q=0.9,en;q=0.7",
        "accept":"text/html,application/xhtml+xml"
      }
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.text();
  }finally{
    clearTimeout(timer);
  }
}

function rowTextForAnchor($, a){
  const $a=$(a);
  let $row=$a.closest("tr");
  let current="";
  let nearby="";

  if($row.length){
    current=clean($row.text());
    // Date/time is commonly placed in the immediately preceding table row(s).
    const $p1=$row.prev("tr");
    const $p2=$p1.prev("tr");
    nearby=clean([$p2.text(),$p1.text(),current].join(" "));
  }else{
    // Generic fallback for div-based layouts: smallest useful ancestor only.
    let n=$a;
    for(let i=0;i<9;i++){
      n=n.parent();
      if(!n.length)break;
      const txt=clean(n.text());
      if(txt.length>0 && txt.length<1600){
        current=txt;
        if(/\d{1,2}:\d{2}|ABSE\.?|Absetzung/i.test(txt))break;
      }
    }
    nearby=current;
  }
  return {current,nearby};
}

function extractKickoff(text){
  // First prefer explicit "... - 15:30 Uhr" / "15:30 Uhr".
  let m=String(text||"").match(/(?:-|^|\s)([0-2]?\d:[0-5]\d)\s*Uhr\b/i);
  if(m)return m[1].padStart(5,"0");

  // FUSSBALL.DE compact row: "So, 09.08.26 | 15:30 | ..."
  m=String(text||"").match(/(?:^|[|,\s])([0-2]?\d:[0-5]\d)(?=\s*(?:[|,]|$))/);
  if(m)return m[1].padStart(5,"0");
  return "";
}

function statusFromSameRow(text){
  // Deliberately ONLY the same fixture row. Never inspect a neighbouring game.
  const t=String(text||"");
  if(/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t))return "abgesetzt";
  if(/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t))return "ausfall";
  if(/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t))return "abbruch";
  if(/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t))return "verlegt";
  return "geplant";
}

function dateFromOverview(text){
  let m=String(text||"").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  m=String(text||"").match(/(\d{2})\.(\d{2})\.(\d{2})(?!\d)/);
  if(m)return `20${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

function inferHomeFromCurrentRow(text){
  const t=clean(text).replace(/\s+Zum Spiel\s*$/i,"");
  // Team row on FUSSBALL.DE uses "home : away".
  const p=t.split(/\s+:\s+/);
  if(p.length<2)return null;
  const left=p[0], right=p.slice(1).join(" : ")
    .replace(/\b(?:Absetzung|Spielabsetzung|Ausfall|Spielausfall|Abbruch|Spielabbruch)\b.*$/i,"")
    .trim();
  return {home:left,away:right,isHome:/Gemmingen/i.test(left)};
}


function externalIdFromUrl(url){
  const m=String(url||"").match(/\/spiel\/([A-Z0-9]+)(?:\/|$)/i);
  return m ? m[1] : String(url||"");
}

function officialDisplayName(category,team){
  const cat=clean(category);
  const raw=clean(team).replace(/\u200b/g,"");
  const normalized=raw.replace(/\s*\/\s*/g,"/").replace(/\s+/g," ").trim();

  if(/^Herren$/i.test(cat) && /SG Stebbach\/Gemmingen 2/i.test(normalized))return "Herren - SG Stebbach/Gemmingen 2";
  if(/^Herren$/i.test(cat) && /SG Stebbach\/Gemmingen/i.test(normalized))return "Herren - SG Stebbach/Gemmingen";
  if(/^Frauen$/i.test(cat) && /SV Gemmingen/i.test(normalized))return "Frauen - SV Gemmingen";
  if(/^A-Junioren$/i.test(cat))return "A-Junioren - JSG Gemmingen / Stebbach";
  if(/^B-Junioren$/i.test(cat))return "B-Junioren - JSG Gemmingen/Stebbach";
  if(/^C-Junioren$/i.test(cat) && /2\b/.test(normalized))return "C-Junioren - JSG Gemmingen/Stebbach 2";
  if(/^C-Junioren$/i.test(cat))return "C-Junioren - JSG Gemmingen/Stebbach";
  if(/^D-Junioren$/i.test(cat))return "D-Junioren - JSG Gemmingen/Stebbach";
  return `${cat} - ${raw}`;
}

function isOurTeamName(name){
  return /(?:SV Gemmingen|SG Stebbach\/?\s*Gemmingen|JSG Gemmingen\s*\/?\s*Stebbach)/i.test(String(name||""));
}

function parseDateTimeHeader(text){
  const t=clean(text);
  const dm=t.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*([0-2]?\d:[0-5]\d)\s*Uhr/i);
  if(dm)return {date:`${dm[3]}-${dm[2]}-${dm[1]}`,kickoff:dm[4].padStart(5,"0")};
  const dm2=t.match(/(\d{2})\.(\d{2})\.(\d{2}).{0,20}([0-2]?\d:[0-5]\d)/i);
  if(dm2)return {date:`20${dm2[3]}-${dm2[2]}-${dm2[1]}`,kickoff:dm2[4].padStart(5,"0")};
  return {date:"",kickoff:""};
}

async function collectOverviewItems(){
  // The normal club page exposes the fixture headers very reliably:
  // "Sonntag, 09.08.2026 - 10:30 Uhr | Frauen | ..."
  const clubUrl=`https://www.fussball.de/verein/sv-gemmingen-baden/-/id/${FUSSBALL_CLUB_ID}`;
  syncLog("Lade aktuellen Vereinsspielplan …");
  const html=await fetchText(clubUrl,15000);
  const $=cheerio.load(html);
  const out=[],seen=new Set();

  $('a[href*="/spiel/"]').each((_,a)=>{
    let url=$(a).attr("href")||"";
    try{url=new URL(url,"https://www.fussball.de").href.split("?")[0]}catch{return}
    const externalId=externalIdFromUrl(url);
    if(!externalId||seen.has(externalId))return;
    seen.add(externalId);

    // Get the smallest fixture container containing both teams.
    let node=$(a),fixtureText="";
    for(let i=0;i<12;i++){
      node=node.parent();
      if(!node.length)break;
      const txt=clean(node.text());
      if(txt.length>20 && txt.length<2200 && /:\s*/.test(txt)){
        fixtureText=txt;
        if(/\d{1,2}:\d{2}|Absetzung|ABSE\./i.test(txt))break;
      }
    }

    // Search this container and a few preceding siblings for the date/time/category header.
    let headerText=fixtureText;
    let sib=node;
    for(let i=0;i<4;i++){
      sib=sib.prev();
      if(!sib.length)break;
      headerText=clean(sib.text()+" "+headerText);
      if(/\d{2}\.\d{2}\.\d{4}\s*-\s*\d{1,2}:\d{2}\s*Uhr/i.test(headerText))break;
    }

    const meta=parseDateTimeHeader(headerText);
    const categoryMatch=headerText.match(/\b(Herren|Frauen|A-Junioren|B-Junioren|C-Junioren|D-Junioren)\b/i);
    const category=categoryMatch?categoryMatch[1]:"";

    // Extract home/away from links in fixture container when possible.
    const teamLinks=node.find("a").map((_,x)=>clean($(x).text())).get()
      .filter(t=>t && !/Zum Spiel|Absetzung|Spielbericht/i.test(t));
    let home="",away="";
    if(teamLinks.length>=2){
      // last two real named participants around the match link are generally the teams
      const candidates=teamLinks.filter(t=>!/^(\d+|FS|ME|PO|TU)$/i.test(t));
      if(candidates.length>=2){home=candidates[0];away=candidates[1]}
    }
    if(!home||!away){
      const colon=fixtureText.split(/\s+:\s+/);
      if(colon.length>=2){
        home=clean(colon[0]).replace(/^.*?\b(?:FS|ME|PO|TU)\b\s*\d*\s*/,"");
        away=clean(colon.slice(1).join(" : ")).replace(/\b(?:Absetzung|Zum Spiel).*$/i,"");
      }
    }

    // Status only from THIS fixture's text.
    let status="geplant";
    if(/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(fixtureText))status="abgesetzt";
    else if(/\bAusfall\b|\bSpielausfall\b/i.test(fixtureText))status="ausfall";
    else if(/\bAbbruch\b|\bSpielabbruch\b/i.test(fixtureText))status="abbruch";

    // competition usually appears alongside category in the header
    let competition="";
    const compMatch=headerText.match(/\b(?:Herren|Frauen|A-Junioren|B-Junioren|C-Junioren|D-Junioren)\b\s+(.{2,80}?)(?=\s+(?:FS|ME|PO|TU)\b|$)/i);
    if(compMatch)competition=clean(compMatch[1]);

    out.push({
      url,externalId,date:meta.date,kickoff:meta.kickoff,category,
      home,away,status,competition,fixtureText,headerText
    });
  });

  syncLog(`Vereinsspielplan geladen: ${out.length} Begegnungen`);
  return out;
}

async function getVenueFromDetail(item){
  if(item.status==="abgesetzt"||item.status==="ausfall"||item.status==="abbruch"){
    return {location:"",address:"",pitch:""};
  }
  try{
    const html=await fetchText(item.url,10000);
    const $=cheerio.load(html);

    // FUSSBALL.DE detail page exposes a Google Maps link whose text contains
    // e.g. "Rasenplatz, SV Gemmingen, Beim Sportplatz 3, 75050 Gemmingen".
    let venue="";
    $('a[href*="google"]').each((_,a)=>{
      const txt=clean($(a).text());
      if(!venue && /75050\s+Gemmingen|Beim Sportplatz|Jahnweg/i.test(txt))venue=txt;
    });
    if(!venue){
      const body=clean($("body").text());
      const m=body.match(/((?:Rasenplatz|Kunstrasenplatz|Hartplatz|Sportplatz).{0,100}(?:Beim Sportplatz|Jahnweg).{0,100}75050\s+Gemmingen(?:-Stebbach)?)/i);
      if(m)venue=clean(m[1]);
    }

    let location="",address="",base="Hauptplatz";
    if(/Jahnweg/i.test(venue)){
      location="Stebbach";address="Jahnweg 1, 75050 Gemmingen-Stebbach";
    }else if(/Beim Sportplatz/i.test(venue)){
      location="Gemmingen";address="Beim Sportplatz 3, 75050 Gemmingen";
    }
    if(/Kunstrasen|Trainingsplatz/i.test(venue))base="Trainingsplatz";
    return {location,address,pitch:location?`${base} – Gesamt`:""};
  }catch(e){
    console.warn(`[FUSSBALL-SYNC] Spielstätte ${item.externalId}: ${e.message}`);
    return {location:"",address:"",pitch:""};
  }
}

async function buildHomeGame(item){
  if(!item.date)return null;

  // Use the fixture home/away assignment to decide if it is actually a home game.
  if(!isOurTeamName(item.home))return null;

  const venue=await getVenueFromDetail(item);
  const displayTeam=officialDisplayName(item.category,item.home);
  return {
    date:item.date,
    start:item.kickoff||"00:00",
    end:item.kickoff?datePlusMinutes(item.date,item.kickoff,120):"00:01",
    kickoffKnown:Boolean(item.kickoff),
    type:"Heimspiel",
    team:displayTeam,
    opponent:clean(item.away),
    competition:item.competition||item.category,
    location:venue.location||(item.status==="abgesetzt"?"—":"PRÜFEN"),
    address:venue.address,
    pitch:venue.pitch,
    homeCabin:"",
    guestCabin:"",
    status:item.status,
    note:item.status==="abgesetzt"?"ABGESETZT":(venue.location?"":"SPIELORT PRÜFEN"),
    source:"fussball.de",
    externalId:item.externalId,
    externalUrl:item.url
  };
}

async function upsertImported(e){
  const found=await db(`select id from clubplanner_events where source='fussball.de' and external_id=$1`,[e.externalId]);
  if(found.rowCount){
    await db(`update clubplanner_events set
      event_date=$2,start_time=$3,end_time=$4,kickoff_known=$5,event_type=$6,team=$7,opponent=$8,competition=$9,
      location=$10,address=$11,pitch=$12,home_cabin=$13,guest_cabin=$14,status=$15,note=$16,
      external_url=$17,updated_at=now() where id=$1`,
      [found.rows[0].id,e.date,e.start,e.end,e.kickoffKnown!==false,e.type,e.team,e.opponent,e.competition,
       e.location,e.address,e.pitch,e.homeCabin,e.guestCabin,e.status,e.note,e.externalUrl]);
    syncState.updated++;
  }else{
    await db(`insert into clubplanner_events(
      id,event_date,start_time,end_time,kickoff_known,event_type,team,opponent,competition,location,address,pitch,
      home_cabin,guest_cabin,status,note,source,external_id,external_url
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'fussball.de',$17,$18)`,
      [crypto.randomUUID(),e.date,e.start,e.end,e.kickoffKnown!==false,e.type,e.team,e.opponent,e.competition,
       e.location,e.address,e.pitch,e.homeCabin,e.guestCabin,e.status,e.note,e.externalId,e.externalUrl]);
    syncState.imported++;
  }
  await db(`insert into clubplanner_teams(id,name) values($1,$2) on conflict(name) do nothing`,[crypto.randomUUID(),e.team]);
}

async function runSync(){
  if(syncState.running)return;
  Object.assign(syncState,{
    running:true,progress:"Starte Synchronisierung …",total:0,processed:0,
    imported:0,updated:0,skipped:0,error:null,
    startedAt:new Date().toISOString(),finishedAt:null,lastActivity:new Date().toISOString()
  });

  const overall=setTimeout(()=>{
    syncState.error="Sicherheits-Timeout nach 120 Sekunden";
  },120000);

  try{
    const items=await collectOverviewItems();
    syncState.total=items.length;
    if(items.length<3)throw new Error(`FUSSBALL.DE lieferte nur ${items.length} Begegnungen.`);

    // Correct all old false statuses by rebuilding every detected home fixture from current source.
    const homeItems=items.filter(i=>isOurTeamName(i.home));
    syncState.skipped=items.length-homeItems.length;

    const concurrency=6;
    for(let offset=0;offset<homeItems.length;offset+=concurrency){
      if(syncState.error)break;
      const batch=homeItems.slice(offset,offset+concurrency);
      await Promise.all(batch.map(async(item,k)=>{
        const idx=offset+k+1;
        try{
          syncLog(`Heimspiel ${idx}/${homeItems.length}: ${item.kickoff||"Zeit offen"} ${item.home||""}`);
          const game=await buildHomeGame(item);
          if(!game){syncState.skipped++;return}
          await upsertImported(game);
        }catch(e){
          console.error(`[FUSSBALL-SYNC] ${item.externalId}: ${e.message}`);
          syncState.skipped++;
        }finally{
          syncState.processed=Math.max(syncState.processed,idx);
        }
      }));
    }

    // Sync exactly the eight official team labels, but preserve user-added teams.
    for(const name of OFFICIAL_TEAMS){
      await db(`insert into clubplanner_teams(id,name,active) values($1,$2,true)
        on conflict(name) do update set active=true`,[crypto.randomUUID(),name]);
    }

    if(!syncState.error)syncLog(`Fertig: ${syncState.imported} neu · ${syncState.updated} aktualisiert · ${syncState.skipped} übersprungen`);
    syncState.finishedAt=new Date().toISOString();
  }catch(e){
    syncState.error=e.name==="AbortError"?"FUSSBALL.DE Timeout":e.message;
    syncLog(`Synchronisierung fehlgeschlagen: ${syncState.error}`);
  }finally{
    clearTimeout(overall);
    syncState.running=false;
    syncState.finishedAt=syncState.finishedAt||new Date().toISOString();
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


app.delete("/api/calendar/reset",requirePin,async(req,res)=>{
  try{
    // Explicit destructive action: the same edit PIN is required again
    // via x-edit-pin header. This deletes calendar events only, not teams/resources.
    const before=await db(`select count(*)::int as count from clubplanner_events`);
    await db(`delete from clubplanner_events`);
    res.json({ok:true,deleted:before.rows[0]?.count||0});
  }catch(e){
    console.error("Kalender-Reset fehlgeschlagen:",e);
    res.status(500).json({error:"Kalender konnte nicht zurückgesetzt werden: "+e.message});
  }
});

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

initDb().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log(`ClubPlanner Sprint 3.5 läuft auf Port ${PORT}`)))
.catch(e=>{console.error("DB-Startfehler",e);process.exit(1)});
