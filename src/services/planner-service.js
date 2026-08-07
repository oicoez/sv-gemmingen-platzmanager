import { listOccupancyEvents } from "../repositories/planner-repository.js";
import { buildSegments } from "../domain/allocation-engine.js";
const iso=d=>d.toISOString().slice(0,10);
export function mondayOf(dateString){
  const d=dateString?new Date(`${dateString}T12:00:00Z`):new Date();
  const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);return iso(d);
}
function addDays(s,n){const d=new Date(`${s}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return iso(d)}
export async function buildWeekPlan(startInput){
  const start=mondayOf(startInput),end=addDays(start,6);
  const events=await listOccupancyEvents(start,end),groups=new Map();
  for(const e of events){
    if(!e.base_name)continue;
    const date=String(e.event_date).slice(0,10),key=`${date}|${e.location_id}|${e.base_name}`;
    if(!groups.has(key))groups.set(key,{date,locationId:e.location_id,location:e.location,baseName:e.base_name,events:[]});
    groups.get(key).events.push(e);
  }
  const days=[];
  for(let i=0;i<7;i++){
    const date=addDays(start,i);
    const gs=[...groups.values()].filter(g=>g.date===date).map(g=>({
      locationId:g.locationId,location:g.location,baseName:g.baseName,segments:buildSegments(g.events)
    })).sort((a,b)=>`${a.location}${a.baseName}`.localeCompare(`${b.location}${b.baseName}`,"de"));
    days.push({date,groups:gs});
  }
  const conflicts=days.flatMap(d=>d.groups.flatMap(g=>g.segments.filter(s=>s.conflict).map(s=>({
    date:d.date,location:g.location,baseName:g.baseName,start:s.start,end:s.end,reason:s.reason
  }))));
  return {start,end,days,conflicts};
}
