import crypto from "crypto";
import { db } from "../database/client.js";

const COLORS=new Set(["#FFF4BF","#E1F4E5","#E4F1FF","#EFE6FA","#FFE8CC","#F2EBDD","#DFF4F1","#EEF1F4","#F8E6F0"]);
const slug=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,32)||"ort";

export async function listResources(){
  const q=await db(`select r.id,r.location_id,l.name location_name,l.address,l.user_managed as location_user_managed,
      r.resource_type,r.base_name,r.section,r.display_name,r.division_count,r.calendar_color,r.user_managed
    from cp5_resources r join cp5_locations l on l.id=r.location_id
    where r.active=true and l.active=true
    order by case l.id when 'gemmingen' then 1 when 'stebbach' then 2 when 'schule' then 3 when 'kraichgauhalle' then 4 else 9 end,
      l.name,case r.resource_type when 'pitch' then 1 else 2 end,r.base_name,r.section`);
  return q.rows.map(r=>({...r,ui_name:r.resource_type==="cabin"
    ?(r.base_name==="Heimkabine"?"Kabine 1 (Heim)":"Kabine 2 (Gast)"):r.display_name}));
}

export async function resourceOverview(){
  const rows=await listResources();
  const ids=[...new Set(rows.map(x=>x.location_id))];
  const locations=[];
  for(const id of ids){
    const mine=rows.filter(x=>x.location_id===id),first=mine[0]; if(!first)continue;
    const whole=mine.filter(x=>x.resource_type==="pitch"&&x.section==="whole");
    const pitches=whole.map(x=>({
      id:x.id,baseName:x.base_name,divisionCount:Number(x.division_count||1),
      color:x.calendar_color,userManaged:Boolean(x.user_managed),
      tags:Number(x.division_count)===1?["Gesamt"]:
        Number(x.division_count)===3?["Gesamt","1/3","2/3","3/3"]:["Gesamt","Hälfte A","Hälfte B"]
    }));
    const cabins=mine.filter(x=>x.resource_type==="cabin").map(x=>({id:x.id,name:x.ui_name,baseName:x.base_name}));
    locations.push({id,name:first.location_name,address:first.address,userManaged:Boolean(first.location_user_managed),pitches,cabins});
  }
  return {locations,colors:[...COLORS]};
}

export async function addTrainingPlace({name,address="",baseName="Trainingsplatz",divisionCount=1,color="#EEF1F4"}){
  name=String(name||"").trim(); baseName=String(baseName||"").trim(); address=String(address||"").trim();
  divisionCount=Number(divisionCount);
  if(!name||!baseName)throw new Error("Ort und Flächenname sind erforderlich");
  if(![1,2,3].includes(divisionCount))throw new Error("Teilbarkeit muss 1, 2 oder 3 sein");
  color=String(color||"").toUpperCase();
  if(!COLORS.has(color))throw new Error("Ungültige Kalenderfarbe");
  const exists=await db(`select id from cp5_locations where lower(name)=lower($1) and active=true limit 1`,[name]);
  if(exists.rowCount)throw new Error("Ein Trainingsort mit diesem Namen existiert bereits");
  const locationId=`${slug(name)}-${crypto.randomUUID().slice(0,6)}`;
  await db(`insert into cp5_locations(id,name,address,user_managed,active) values($1,$2,$3,true,true)`,[locationId,name,address]);
  const sections=divisionCount===1?[["whole","Gesamt"]]:
    divisionCount===2?[["whole","Gesamt"],["half_a","Hälfte A"],["half_b","Hälfte B"]]:
    [["whole","Gesamt"],["third_1","Drittel 1"],["third_2","Drittel 2"],["third_3","Drittel 3"]];
  for(const [section,label] of sections){
    await db(`insert into cp5_resources(id,location_id,resource_type,base_name,section,display_name,division_count,calendar_color,user_managed)
      values($1,$2,'pitch',$3,$4,$5,$6,$7,true)`,
      [crypto.randomUUID(),locationId,baseName,section,`${baseName} – ${label}`,divisionCount,color]);
  }
  return locationId;
}

export async function updatePlaceColor(locationId,color){
  color=String(color||"").toUpperCase();
  if(!COLORS.has(color))throw new Error("Ungültige Kalenderfarbe");
  const loc=await db(`select * from cp5_locations where id=$1 and active=true limit 1`,[locationId]);
  if(!loc.rowCount)throw new Error("Trainingsort nicht gefunden");
  await db(`update cp5_resources set calendar_color=$2 where location_id=$1 and resource_type='pitch'`,[locationId,color]);
  return true;
}

export async function removeTrainingPlace(locationId){
  const loc=await db(`select * from cp5_locations where id=$1 and active=true limit 1`,[locationId]);
  if(!loc.rowCount)throw new Error("Trainingsort nicht gefunden");
  if(!loc.rows[0].user_managed)throw new Error("Dieser feste Vereinsstandort kann nicht gelöscht werden");
  const used=await db(`select count(*)::int n from cp5_events where location_id=$1 and event_date>=current_date`,[locationId]);
  const series=await db(`select count(*)::int n from cp5_training_series where location_id=$1 and active=true`,[locationId]);
  if(used.rows[0].n||series.rows[0].n)throw new Error("Ort wird noch von zukünftigen Trainings oder Trainingsserien verwendet");
  await db(`update cp5_resources set active=false where location_id=$1`,[locationId]);
  await db(`update cp5_locations set active=false where id=$1`,[locationId]);
  return true;
}
