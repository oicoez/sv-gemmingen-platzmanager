
import express from "express";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const PORT = process.env.PORT || 10000;
const DATA = path.join(__dirname,"data.json");
const EXPORT = path.join(__dirname,"ClubPlanner_Export.xlsx");

const defaultData = {
  settings:{
    club:"SV Gemmingen / SG Stebbach-Gemmingen",
    locations:[
      {
        id:"gemmingen",
        name:"Gemmingen",
        address:"Beim Sportplatz 3, 75050 Gemmingen",
        pitches:["Hauptplatz","Trainingsplatz"],
        cabins:["Heimkabine","Gastkabine"]
      },
      {
        id:"stebbach",
        name:"Stebbach",
        address:"Jahnweg 1, 75050 Gemmingen-Stebbach",
        pitches:["Hauptplatz","Trainingsplatz"],
        cabins:["Heimkabine","Gastkabine"]
      }
    ]
  },
  events:[]
};

async function ensureData(){
  try{ await fs.access(DATA); }
  catch{ await fs.writeFile(DATA,JSON.stringify(defaultData,null,2),"utf8"); }
}
async function load(){ await ensureData(); return JSON.parse(await fs.readFile(DATA,"utf8")); }
async function save(d){ await fs.writeFile(DATA,JSON.stringify(d,null,2),"utf8"); }

function overlap(a,b){
  if(a.date!==b.date) return false;
  const m=t=>{ if(!t) return null; const [h,min]=t.split(":").map(Number); return h*60+min; };
  const as=m(a.start), ae=m(a.end), bs=m(b.start), be=m(b.end);
  if([as,ae,bs,be].some(x=>x===null)) return false;
  return as<be && bs<ae;
}
function conflicts(events){
  const out=[];
  for(let i=0;i<events.length;i++){
    for(let j=i+1;j<events.length;j++){
      const a=events[i],b=events[j];
      if(!overlap(a,b)) continue;
      const reasons=[];
      if(a.location===b.location && a.pitch && b.pitch && a.pitch===b.pitch) reasons.push(`Platz: ${a.pitch}`);
      if(a.location===b.location && a.homeCabin && b.homeCabin && a.homeCabin===b.homeCabin) reasons.push(`Kabine: ${a.homeCabin}`);
      if(a.location===b.location && a.guestCabin && b.guestCabin && a.guestCabin===b.guestCabin) reasons.push(`Kabine: ${a.guestCabin}`);
      if(reasons.length) out.push({a:a.id,b:b.id,reasons});
    }
  }
  return out;
}

app.get("/health",(req,res)=>res.json({ok:true}));
app.get("/api/data",async(req,res)=>{
  const d=await load();
  res.json({...d,conflicts:conflicts(d.events)});
});

app.post("/api/events",async(req,res)=>{
  const d=await load();
  const e=req.body||{};
  e.id=e.id||crypto.randomUUID();
  e.type=e.type||"Training";
  d.events.push(e);
  await save(d);
  res.json({ok:true,event:e,conflicts:conflicts(d.events)});
});

app.put("/api/events/:id",async(req,res)=>{
  const d=await load();
  const i=d.events.findIndex(x=>x.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Nicht gefunden"});
  d.events[i]={...d.events[i],...req.body,id:req.params.id};
  await save(d);
  res.json({ok:true,event:d.events[i],conflicts:conflicts(d.events)});
});

app.delete("/api/events/:id",async(req,res)=>{
  const d=await load();
  d.events=d.events.filter(x=>x.id!==req.params.id);
  await save(d);
  res.json({ok:true});
});

app.get("/api/export",async(req,res)=>{
  const d=await load();
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet("Belegungsplan",{views:[{state:"frozen",ySplit:1}]});
  ws.columns=[
    ["Datum",13],["Von",9],["Bis",9],["Art",14],["Mannschaft",28],["Gegner / Info",28],
    ["Ort",16],["Platz",18],["Heimkabine",16],["Gastkabine",16],["Status",14],["Bemerkung",28]
  ].map(([header,width])=>({header,width}));
  ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
  ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}};

  const cf=conflicts(d.events);
  const conflictIds=new Set(cf.flatMap(x=>[x.a,x.b]));

  const ev=[...d.events].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  for(const e of ev){
    const row=ws.addRow([
      e.date,e.start,e.end,e.type,e.team,e.opponent||e.info||"",e.location,e.pitch,
      e.homeCabin||"",e.guestCabin||"",e.status||"geplant",e.note||""
    ]);
    if(conflictIds.has(e.id)) row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF4B084"}};
  }
  ws.autoFilter={from:"A1",to:"L1"};
  await wb.xlsx.writeFile(EXPORT);
  res.download(EXPORT,"ClubPlanner_SV_Gemmingen.xlsx");
});

app.listen(PORT,"0.0.0.0",()=>console.log(`ClubPlanner auf Port ${PORT}`));
