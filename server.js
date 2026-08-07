
import express from "express";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

const PORT = process.env.PORT || 10000;
const EDIT_PIN = process.env.EDIT_PIN || "1234";
const DATA_FILE = path.join(__dirname,"data.json");
const EXPORT_FILE = path.join(__dirname,"ClubPlanner_SV_Gemmingen.xlsx");

const initial = {
  club:{name:"SV Gemmingen / SG Stebbach-Gemmingen"},
  locations:[
    {id:"gemmingen",name:"Gemmingen",address:"Beim Sportplatz 3, 75050 Gemmingen",pitches:["Hauptplatz","Trainingsplatz"],cabins:["Heimkabine","Gastkabine"]},
    {id:"stebbach",name:"Stebbach",address:"Jahnweg 1, 75050 Gemmingen-Stebbach",pitches:["Hauptplatz","Trainingsplatz"],cabins:["Heimkabine","Gastkabine"]}
  ],
  teams:["Herren I","Herren II","Frauen","A-Junioren","B-Junioren","C1-Junioren","C2-Junioren","D-Junioren"],
  events:[]
};

async function ensureData(){try{await fs.access(DATA_FILE)}catch{await fs.writeFile(DATA_FILE,JSON.stringify(initial,null,2),"utf8")}}
async function load(){await ensureData();return JSON.parse(await fs.readFile(DATA_FILE,"utf8"))}
async function save(d){await fs.writeFile(DATA_FILE,JSON.stringify(d,null,2),"utf8")}
function requirePin(req,res,next){if(req.headers["x-edit-pin"]!==EDIT_PIN)return res.status(401).json({error:"Bearbeitungs-PIN falsch"});next()}
function min(t){if(!t||!/^[0-9]{2}:[0-9]{2}$/.test(t))return null;const [h,m]=t.split(":").map(Number);return h*60+m}
function overlap(a,b){if(a.date!==b.date)return false;const as=min(a.start),ae=min(a.end),bs=min(b.start),be=min(b.end);if([as,ae,bs,be].some(x=>x===null))return false;return as<be&&bs<ae}
function getConflicts(events){
  const out=[], active=e=>!["abgesetzt","ausfall","abbruch"].includes(String(e.status||"").toLowerCase());
  for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){const a=events[i],b=events[j];if(!active(a)||!active(b)||!overlap(a,b))continue;const reasons=[];
    if(a.location===b.location&&a.pitch&&a.pitch===b.pitch)reasons.push(`Platz ${a.pitch}`);
    if(a.location===b.location){const A=[a.homeCabin,a.guestCabin].filter(Boolean),B=[b.homeCabin,b.guestCabin].filter(Boolean);for(const c of A)if(B.includes(c))reasons.push(`Kabine ${c}`)}
    if(reasons.length)out.push({a:a.id,b:b.id,reasons});
  } return out;
}

app.get("/health",(req,res)=>res.json({ok:true}));
app.post("/api/login",(req,res)=>res.json({ok:req.body?.pin===EDIT_PIN}));
app.get("/api/data",async(req,res)=>{const d=await load();res.json({...d,conflicts:getConflicts(d.events)})});
app.post("/api/events",requirePin,async(req,res)=>{const d=await load(),e=req.body||{};e.id=crypto.randomUUID();d.events.push(e);await save(d);res.json({ok:true})});
app.delete("/api/events/:id",requirePin,async(req,res)=>{const d=await load();d.events=d.events.filter(x=>x.id!==req.params.id);await save(d);res.json({ok:true})});
app.post("/api/teams",requirePin,async(req,res)=>{const d=await load(),name=String(req.body?.name||"").trim();if(!name)return res.status(400).json({error:"Name fehlt"});if(!d.teams.includes(name))d.teams.push(name);await save(d);res.json({ok:true})});
app.delete("/api/teams/:name",requirePin,async(req,res)=>{const d=await load();d.teams=d.teams.filter(x=>x!==decodeURIComponent(req.params.name));await save(d);res.json({ok:true})});
app.get("/api/backup",async(req,res)=>{const d=await load();res.setHeader("Content-Disposition",'attachment; filename="ClubPlanner_Backup.json"');res.json(d)});
app.get("/api/export",async(req,res)=>{
  const d=await load(),cf=getConflicts(d.events),ids=new Set(cf.flatMap(c=>[c.a,c.b]));
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Belegungsplan",{views:[{state:"frozen",ySplit:1}]});
  ws.columns=[["Datum",13],["Von",9],["Bis",9],["Art",14],["Mannschaft",28],["Gegner / Info",28],["Ort",16],["Platz",18],["Heimkabine",16],["Gastkabine",16],["Status",14],["Bemerkung",28]].map(([header,width])=>({header,width}));
  ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}};
  for(const e of [...d.events].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start))){const r=ws.addRow([e.date,e.start,e.end,e.type,e.team,e.opponent||"",e.location,e.pitch,e.homeCabin||"",e.guestCabin||"",e.status||"geplant",e.note||""]);if(ids.has(e.id))r.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF4B084"}}}
  ws.autoFilter={from:"A1",to:"L1"};await wb.xlsx.writeFile(EXPORT_FILE);res.download(EXPORT_FILE,"ClubPlanner_SV_Gemmingen.xlsx");
});
app.listen(PORT,"0.0.0.0",()=>console.log(`ClubPlanner Sprint 1 läuft auf Port ${PORT}`));
