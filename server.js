import express from "express";
import ExcelJS from "exceljs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

const PORT = process.env.PORT || 10000;
const EDIT_PIN = process.env.EDIT_PIN || "1234";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL fehlt. Bitte in Render unter Environment anlegen.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

const DEFAULT_TEAMS = ["Herren I","Herren II","Frauen","A-Junioren","B-Junioren","C1-Junioren","C2-Junioren","D-Junioren"];
const q = (sql, params=[]) => pool.query(sql, params);

async function initDb(){
  await q(`create table if not exists clubplanner_teams (
    id uuid primary key,
    name text not null unique,
    created_at timestamptz not null default now()
  )`);
  await q(`create table if not exists clubplanner_events (
    id uuid primary key,
    event_date date not null,
    start_time time not null,
    end_time time not null,
    event_type text not null,
    team text not null,
    opponent text default '',
    location text not null,
    pitch text default '',
    home_cabin text default '',
    guest_cabin text default '',
    status text default 'geplant',
    note text default '',
    source text default 'manual',
    external_id text,
    external_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await q(`create index if not exists idx_clubplanner_events_date on clubplanner_events(event_date)`);
  await q(`create unique index if not exists uq_clubplanner_events_external on clubplanner_events(source, external_id) where external_id is not null`);
  for(const name of DEFAULT_TEAMS){
    await q(`insert into clubplanner_teams(id,name) values($1,$2) on conflict(name) do nothing`,[crypto.randomUUID(),name]);
  }
  console.log("Supabase/PostgreSQL Tabellen sind bereit.");
}

function requirePin(req,res,next){
  if(req.headers["x-edit-pin"]!==EDIT_PIN) return res.status(401).json({error:"Bearbeitungs-PIN falsch"});
  next();
}
function minutes(t){
  const s=String(t||"").slice(0,5);
  if(!/^\d{2}:\d{2}$/.test(s)) return null;
  const [h,m]=s.split(":").map(Number); return h*60+m;
}
function overlap(a,b){
  if(a.date!==b.date) return false;
  const as=minutes(a.start),ae=minutes(a.end),bs=minutes(b.start),be=minutes(b.end);
  if([as,ae,bs,be].some(x=>x===null)) return false;
  return as<be && bs<ae;
}
function getConflicts(events){
  const out=[];
  const active=e=>!["abgesetzt","ausfall","abbruch"].includes(String(e.status||"").toLowerCase());
  for(let i=0;i<events.length;i++) for(let j=i+1;j<events.length;j++){
    const a=events[i],b=events[j];
    if(!active(a)||!active(b)||!overlap(a,b)) continue;
    const reasons=[];
    if(a.location===b.location && a.pitch && a.pitch===b.pitch) reasons.push(`Platz ${a.pitch}`);
    if(a.location===b.location){
      const A=[a.homeCabin,a.guestCabin].filter(Boolean), B=[b.homeCabin,b.guestCabin].filter(Boolean);
      for(const c of A) if(B.includes(c)) reasons.push(`Kabine ${c}`);
    }
    if(reasons.length) out.push({a:a.id,b:b.id,reasons:[...new Set(reasons)]});
  }
  return out;
}
function mapEvent(r){
  return {
    id:r.id,
    date:r.event_date instanceof Date ? r.event_date.toISOString().slice(0,10) : String(r.event_date).slice(0,10),
    start:String(r.start_time||"").slice(0,5),
    end:String(r.end_time||"").slice(0,5),
    type:r.event_type, team:r.team, opponent:r.opponent||"", location:r.location,
    pitch:r.pitch||"", homeCabin:r.home_cabin||"", guestCabin:r.guest_cabin||"",
    status:r.status||"geplant", note:r.note||"", source:r.source||"manual",
    externalId:r.external_id||null, externalUrl:r.external_url||null
  };
}
async function getAllData(){
  const [teamsRes,eventsRes]=await Promise.all([
    q(`select name from clubplanner_teams order by name`),
    q(`select * from clubplanner_events order by event_date,start_time,team`)
  ]);
  const events=eventsRes.rows.map(mapEvent);
  return {
    club:{name:"SV Gemmingen / SG Stebbach-Gemmingen"},
    locations:[
      {id:"gemmingen",name:"Gemmingen",address:"Beim Sportplatz 3, 75050 Gemmingen",pitches:["Hauptplatz","Trainingsplatz"],cabins:["Heimkabine","Gastkabine"]},
      {id:"stebbach",name:"Stebbach",address:"Jahnweg 1, 75050 Gemmingen-Stebbach",pitches:["Hauptplatz","Trainingsplatz"],cabins:["Heimkabine","Gastkabine"]}
    ],
    teams:teamsRes.rows.map(x=>x.name), events, conflicts:getConflicts(events)
  };
}

app.get("/health",async(req,res)=>{
  try{await q("select 1");res.json({ok:true,database:"connected"})}
  catch(e){res.status(500).json({ok:false,database:"error",error:e.message})}
});
app.get("/api/db-status",async(req,res)=>{
  try{
    const r=await q(`select now() as now,
      (select count(*) from clubplanner_teams) as teams,
      (select count(*) from clubplanner_events) as events`);
    res.json({ok:true,...r.rows[0]});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.post("/api/login",(req,res)=>res.json({ok:req.body?.pin===EDIT_PIN}));
app.get("/api/data",async(req,res)=>{
  try{res.json(await getAllData())}catch(e){console.error(e);res.status(500).json({error:"Datenbankfehler: "+e.message})}
});
app.post("/api/events",requirePin,async(req,res)=>{
  try{
    const e=req.body||{};
    if(!e.date||!e.start||!e.end||!e.team||!e.type||!e.location) return res.status(400).json({error:"Pflichtfelder fehlen"});
    const id=crypto.randomUUID();
    await q(`insert into clubplanner_events(id,event_date,start_time,end_time,event_type,team,opponent,location,pitch,home_cabin,guest_cabin,status,note,source)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual')`,
      [id,e.date,e.start,e.end,e.type,e.team,e.opponent||"",e.location,e.pitch||"",e.homeCabin||"",e.guestCabin||"",e.status||"geplant",e.note||""]);
    res.json({ok:true,id});
  }catch(e){console.error(e);res.status(500).json({error:"Speichern fehlgeschlagen: "+e.message})}
});
app.delete("/api/events/:id",requirePin,async(req,res)=>{
  try{await q(`delete from clubplanner_events where id=$1`,[req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/teams",requirePin,async(req,res)=>{
  try{
    const name=String(req.body?.name||"").trim(); if(!name) return res.status(400).json({error:"Name fehlt"});
    await q(`insert into clubplanner_teams(id,name) values($1,$2) on conflict(name) do nothing`,[crypto.randomUUID(),name]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});
app.delete("/api/teams/:name",requirePin,async(req,res)=>{
  try{await q(`delete from clubplanner_teams where name=$1`,[decodeURIComponent(req.params.name)]);res.json({ok:true})}
  catch(e){res.status(500).json({error:e.message})}
});
app.get("/api/backup",async(req,res)=>{
  try{const d=await getAllData();res.setHeader("Content-Disposition",'attachment; filename="ClubPlanner_Backup.json"');res.json(d)}
  catch(e){res.status(500).send(e.message)}
});
app.get("/api/export",async(req,res)=>{
  try{
    const d=await getAllData(), ids=new Set(d.conflicts.flatMap(c=>[c.a,c.b]));
    const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Belegungsplan",{views:[{state:"frozen",ySplit:1}]});
    ws.columns=[["Datum",13],["Von",9],["Bis",9],["Art",14],["Mannschaft",28],["Gegner / Info",28],["Ort",16],["Platz",18],["Heimkabine",16],["Gastkabine",16],["Status",14],["Bemerkung",28],["Quelle",12]].map(([header,width])=>({header,width}));
    ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}};
    for(const e of d.events){const r=ws.addRow([e.date,e.start,e.end,e.type,e.team,e.opponent,e.location,e.pitch,e.homeCabin,e.guestCabin,e.status,e.note,e.source]);if(ids.has(e.id))r.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF4B084"}}}
    ws.autoFilter={from:"A1",to:"M1"};
    const buffer=await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",'attachment; filename="ClubPlanner_SV_Gemmingen.xlsx"');
    res.send(Buffer.from(buffer));
  }catch(e){res.status(500).send(e.message)}
});

initDb().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log(`ClubPlanner Sprint 1.1 / Supabase läuft auf Port ${PORT}`)))
.catch(err=>{console.error("Datenbank-Initialisierung fehlgeschlagen:");console.error(err);process.exit(1)});
