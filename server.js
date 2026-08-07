
import express from "express";
import ExcelJS from "exceljs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"3mb"}));
app.use(express.static(path.join(__dirname,"public")));

const PORT = process.env.PORT || 10000;
const EDIT_PIN = process.env.EDIT_PIN || "1234";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(1);
}

const pool = new Pool({
  connectionString:DATABASE_URL,
  ssl:{rejectUnauthorized:false},
  max:5,
  idleTimeoutMillis:30000,
  connectionTimeoutMillis:15000
});
const db=(q,p=[])=>pool.query(q,p);

const DEFAULT_TEAMS=[
  "Herren I","Herren II","Frauen","A-Junioren","B-Junioren",
  "C1-Junioren","C2-Junioren","D-Junioren"
];

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
    id text primary key,
    name text not null unique,
    address text default '',
    active boolean not null default true
  )`);

  await db(`create table if not exists clubplanner_resources(
    id uuid primary key,
    location_id text not null references clubplanner_locations(id) on delete cascade,
    resource_type text not null check(resource_type in ('pitch','cabin')),
    name text not null,
    active boolean not null default true,
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
    location text not null,
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
  await db(`alter table clubplanner_events add column if not exists series_id uuid`);
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
    await db(`insert into clubplanner_teams(id,name) values($1,$2) on conflict(name) do nothing`,
      [crypto.randomUUID(),name]);
  }
  console.log("Sprint 2 Datenbankstruktur ist bereit.");
}

function requirePin(req,res,next){
  if(req.headers["x-edit-pin"]!==EDIT_PIN) return res.status(401).json({error:"Bearbeitungs-PIN falsch"});
  next();
}
const timeMin=t=>{const s=String(t||"").slice(0,5);if(!/^\d{2}:\d{2}$/.test(s))return null;const[a,b]=s.split(":").map(Number);return a*60+b};
const active=e=>!["abgesetzt","ausfall","abbruch"].includes(String(e.status||"").toLowerCase());
function overlap(a,b){
  if(a.date!==b.date)return false;
  const as=timeMin(a.start),ae=timeMin(a.end),bs=timeMin(b.start),be=timeMin(b.end);
  return ![as,ae,bs,be].some(x=>x===null) && as<be && bs<ae;
}
function conflicts(events){
  const out=[];
  for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
    const a=events[i],b=events[j];
    if(!active(a)||!active(b)||!overlap(a,b))continue;
    const reasons=[];
    if(a.location===b.location && a.pitch && b.pitch && a.pitch===b.pitch) reasons.push(`Platz: ${a.pitch}`);
    if(a.location===b.location){
      const ac=[a.homeCabin,a.guestCabin].filter(Boolean),bc=[b.homeCabin,b.guestCabin].filter(Boolean);
      for(const c of ac) if(bc.includes(c)) reasons.push(`Kabine: ${c}`);
    }
    if(reasons.length) out.push({a:a.id,b:b.id,reasons:[...new Set(reasons)]});
  }
  return out;
}
function mapEvent(r){
  return {
    id:r.id,
    date:r.event_date instanceof Date?r.event_date.toISOString().slice(0,10):String(r.event_date).slice(0,10),
    start:String(r.start_time||"").slice(0,5),end:String(r.end_time||"").slice(0,5),
    type:r.event_type,team:r.team,opponent:r.opponent||"",location:r.location,pitch:r.pitch||"",
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
  return {
    club:{name:"SV Gemmingen / SG Stebbach-Gemmingen"},
    teams:t.rows,
    locations:l.rows,
    resources:r.rows,
    events,
    conflicts:conflicts(events)
  };
}

app.get("/health",async(req,res)=>{
  try{await db("select 1");res.json({ok:true,database:"connected"})}
  catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get("/api/db-status",async(req,res)=>{
  try{
    const q=await db(`select now() now,
      (select count(*) from clubplanner_teams) teams,
      (select count(*) from clubplanner_events) events,
      (select count(*) from clubplanner_resources) resources`);
    res.json({ok:true,...q.rows[0]});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.post("/api/login",(req,res)=>res.json({ok:req.body?.pin===EDIT_PIN}));
app.get("/api/data",async(req,res)=>{
  try{res.json(await allData())}catch(e){res.status(500).json({error:e.message})}
});

async function insertEvent(e,id=crypto.randomUUID(),seriesId=null){
  await db(`insert into clubplanner_events(
    id,event_date,start_time,end_time,event_type,team,opponent,location,pitch,
    home_cabin,guest_cabin,status,note,source,series_id
  ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual',$14)`,
  [id,e.date,e.start,e.end,e.type,e.team,e.opponent||"",e.location,e.pitch||"",
   e.homeCabin||"",e.guestCabin||"",e.status||"geplant",e.note||"",seriesId]);
}
app.post("/api/events",requirePin,async(req,res)=>{
  try{
    const e=req.body||{};
    if(!e.date||!e.start||!e.end||!e.team||!e.type||!e.location) return res.status(400).json({error:"Pflichtfelder fehlen"});
    const seriesId=e.repeatWeekly&&e.repeatUntil?crypto.randomUUID():null;
    let count=0;
    if(seriesId){
      let d=new Date(e.date+"T12:00:00");
      const until=new Date(e.repeatUntil+"T12:00:00");
      while(d<=until && count<60){
        const x={...e,date:d.toISOString().slice(0,10)};
        await insertEvent(x,crypto.randomUUID(),seriesId);
        d.setDate(d.getDate()+7);count++;
      }
    }else{
      await insertEvent(e);count=1;
    }
    res.json({ok:true,count,seriesId});
  }catch(e){res.status(500).json({error:"Speichern fehlgeschlagen: "+e.message})}
});
app.put("/api/events/:id",requirePin,async(req,res)=>{
  try{
    const e=req.body||{};
    await db(`update clubplanner_events set event_date=$2,start_time=$3,end_time=$4,event_type=$5,
      team=$6,opponent=$7,location=$8,pitch=$9,home_cabin=$10,guest_cabin=$11,status=$12,note=$13,updated_at=now()
      where id=$1`,
      [req.params.id,e.date,e.start,e.end,e.type,e.team,e.opponent||"",e.location,e.pitch||"",
       e.homeCabin||"",e.guestCabin||"",e.status||"geplant",e.note||""]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});
app.delete("/api/events/:id",requirePin,async(req,res)=>{
  try{await db(`delete from clubplanner_events where id=$1`,[req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:e.message})}
});
app.delete("/api/series/:id",requirePin,async(req,res)=>{
  try{await db(`delete from clubplanner_events where series_id=$1`,[req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/teams",requirePin,async(req,res)=>{
  try{
    const x=req.body||{},name=String(x.name||"").trim();
    if(!name)return res.status(400).json({error:"Name fehlt"});
    await db(`insert into clubplanner_teams(id,name,coach,contact,note,active)
      values($1,$2,$3,$4,$5,true)
      on conflict(name) do update set coach=excluded.coach,contact=excluded.contact,note=excluded.note,active=true`,
      [crypto.randomUUID(),name,x.coach||"",x.contact||"",x.note||""]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});
app.put("/api/teams/:id",requirePin,async(req,res)=>{
  try{
    const x=req.body||{};
    await db(`update clubplanner_teams set name=$2,coach=$3,contact=$4,note=$5,active=$6 where id=$1`,
      [req.params.id,x.name,x.coach||"",x.contact||"",x.note||"",x.active!==false]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});
app.delete("/api/teams/:id",requirePin,async(req,res)=>{
  try{await db(`update clubplanner_teams set active=false where id=$1`,[req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/resources",requirePin,async(req,res)=>{
  try{
    const x=req.body||{};
    await db(`insert into clubplanner_resources(id,location_id,resource_type,name,active)
      values($1,$2,$3,$4,true) on conflict(location_id,resource_type,name) do update set active=true`,
      [crypto.randomUUID(),x.locationId,x.type,x.name]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});
app.delete("/api/resources/:id",requirePin,async(req,res)=>{
  try{await db(`update clubplanner_resources set active=false where id=$1`,[req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:e.message})}
});

app.get("/api/export",async(req,res)=>{
  try{
    const d=await allData(),ids=new Set(d.conflicts.flatMap(x=>[x.a,x.b]));
    const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Belegungsplan",{views:[{state:"frozen",ySplit:1}]});
    ws.columns=[["Datum",13],["Von",9],["Bis",9],["Art",14],["Mannschaft",28],["Gegner / Info",28],
      ["Ort",16],["Platz",18],["Heimkabine",16],["Gastkabine",16],["Status",14],["Bemerkung",28],["Quelle",12]]
      .map(([header,width])=>({header,width}));
    ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
    ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}};
    for(const e of d.events){
      const row=ws.addRow([e.date,e.start,e.end,e.type,e.team,e.opponent,e.location,e.pitch,e.homeCabin,e.guestCabin,e.status,e.note,e.source]);
      if(ids.has(e.id))row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF4B084"}};
    }
    const buf=await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",'attachment; filename="ClubPlanner_SV_Gemmingen.xlsx"');
    res.send(Buffer.from(buf));
  }catch(e){res.status(500).send(e.message)}
});

initDb().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log(`ClubPlanner Sprint 2 läuft auf Port ${PORT}`)))
.catch(e=>{console.error("DB-Startfehler",e);process.exit(1)});
