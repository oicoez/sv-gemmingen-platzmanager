import { listOccupancyEvents } from "../repositories/planner-repository.js";
import { buildSegments } from "../domain/allocation-engine.js";
import { findCabinConflicts } from "./cabin-conflict-service.js";
import { mondayOf,addDays,isoFromValue,currentMonthBerlin } from "../utils/date.js";

function normalizeEvent(e){return {...e,event_date:isoFromValue(e.event_date)}}

function summarizeDayEvents(day){
  const items=[];
  for(const g of day.groups){
    for(const s of g.segments){
      for(const i of s.items){
        items.push({
          id:i.id,
          eventType:i.eventType,
          label:i.label,
          location:g.location,
          baseName:g.baseName,
          start:s.start,
          end:s.end,
          section:i.section,
          sectionLabel:i.sectionLabel,
          conflict:s.conflict,
          reason:s.reason
        });
      }
    }
  }
  return items;
}


export async function buildWeekPlan(startInput){
  const start=mondayOf(startInput),end=addDays(start,6);
  const events=(await listOccupancyEvents(start,end)).map(normalizeEvent);
  const groups=new Map();

  for(const e of events){
    if(!e.base_name||!e.event_date)continue;
    const key=`${e.event_date}|${e.location_id}|${e.base_name}`;
    if(!groups.has(key))groups.set(key,{
      date:e.event_date,locationId:e.location_id,location:e.location,baseName:e.base_name,events:[]
    });
    groups.get(key).events.push(e);
  }

  const days=[];
  for(let i=0;i<7;i++){
    const date=addDays(start,i);
    const dayGroups=[...groups.values()]
      .filter(g=>g.date===date)
      .map(g=>({
        locationId:g.locationId,location:g.location,baseName:g.baseName,
        segments:buildSegments(g.events)
      }))
      .sort((a,b)=>`${a.location}${a.baseName}`.localeCompare(`${b.location}${b.baseName}`,"de"));
    days.push({date,groups:dayGroups});
  }

  const pitchConflicts=days.flatMap(d=>d.groups.flatMap(g=>
    g.segments.filter(s=>s.conflict).map(s=>({
      date:d.date,location:g.location,baseName:g.baseName,start:s.start,end:s.end,
      reason:s.reason,items:s.items
    }))
  ));
  const cabinConflicts=findCabinConflicts(events);
  const conflicts=[...pitchConflicts,...cabinConflicts];
  const dayItems=days.map(d=>({date:d.date,items:summarizeDayEvents(d)}));
  return {start,end,days,dayItems,conflicts,pitchConflicts,cabinConflicts};
}

function monthBounds(monthInput){
  const ym=/^\d{4}-\d{2}$/.test(String(monthInput||""))?String(monthInput):currentMonthBerlin();
  const [year,month]=ym.split("-").map(Number);
  const first=`${year}-${String(month).padStart(2,"0")}-01`;
  const next=month===12?`${year+1}-01-01`:`${year}-${String(month+1).padStart(2,"0")}-01`;
  const d=new Date(`${next}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-1);
  return {year,month,ym,first,last:d.toISOString().slice(0,10)};
}

export async function buildMonthPlan(monthInput){
  const {year,month,ym,first,last}=monthBounds(monthInput);
  const events=(await listOccupancyEvents(first,last)).map(normalizeEvent);
  const byDay=new Map();
  for(const e of events){
    if(!e.event_date)continue;
    if(!byDay.has(e.event_date))byDay.set(e.event_date,[]);
    byDay.get(e.event_date).push(e);
  }

  const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
  const days=[];let conflictCount=0,eventCount=0;
  for(let n=1;n<=daysInMonth;n++){
    const date=`${year}-${String(month).padStart(2,"0")}-${String(n).padStart(2,"0")}`;
    const dayEvents=byDay.get(date)||[];eventCount+=dayEvents.length;
    const grouped=new Map();
    for(const e of dayEvents){
      if(!e.base_name)continue;
      const key=`${e.location_id}|${e.base_name}`;
      if(!grouped.has(key))grouped.set(key,{location:e.location,baseName:e.base_name,events:[]});
      grouped.get(key).events.push(e);
    }
    const groups=[...grouped.values()].map(g=>{
      const segments=buildSegments(g.events);
      conflictCount+=segments.filter(s=>s.conflict).length;
      return {location:g.location,baseName:g.baseName,segments};
    });
    days.push({date,groups});
  }
  const cabinConflicts=findCabinConflicts(events);
  conflictCount+=cabinConflicts.length;
  return {month:ym,year,monthNumber:month,first,last,eventCount,conflictCount,days,cabinConflicts};
}
