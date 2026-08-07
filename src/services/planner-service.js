import { listOccupancyEvents } from "../repositories/planner-repository.js";
import { buildSegments } from "../domain/allocation-engine.js";

const iso=d=>d.toISOString().slice(0,10);

function dbDate(value){
  if(!value)return "";
  if(value instanceof Date)return iso(value);
  const s=String(value);
  const direct=s.match(/^(\d{4}-\d{2}-\d{2})/);
  if(direct)return direct[1];
  const d=new Date(value);
  return Number.isNaN(d.getTime())?"":iso(d);
}

export function mondayOf(dateString){
  const d=dateString?new Date(`${dateString}T12:00:00Z`):new Date();
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()-day+1);
  return iso(d);
}

function addDays(s,n){
  const d=new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+n);
  return iso(d);
}

function normalizeEvent(e){
  return {...e,event_date:dbDate(e.event_date)};
}

export async function buildWeekPlan(startInput){
  const start=mondayOf(startInput),end=addDays(start,6);
  const events=(await listOccupancyEvents(start,end)).map(normalizeEvent);
  const groups=new Map();

  for(const e of events){
    if(!e.base_name||!e.event_date)continue;
    const date=e.event_date;
    const key=`${date}|${e.location_id}|${e.base_name}`;
    if(!groups.has(key)){
      groups.set(key,{
        date,
        locationId:e.location_id,
        location:e.location,
        baseName:e.base_name,
        events:[]
      });
    }
    groups.get(key).events.push(e);
  }

  const days=[];
  for(let i=0;i<7;i++){
    const date=addDays(start,i);
    const gs=[...groups.values()]
      .filter(g=>g.date===date)
      .map(g=>({
        locationId:g.locationId,
        location:g.location,
        baseName:g.baseName,
        segments:buildSegments(g.events)
      }))
      .sort((a,b)=>`${a.location}${a.baseName}`.localeCompare(`${b.location}${b.baseName}`,"de"));
    days.push({date,groups:gs});
  }

  const conflicts=days.flatMap(d=>d.groups.flatMap(g=>
    g.segments.filter(s=>s.conflict).map(s=>({
      date:d.date,
      location:g.location,
      baseName:g.baseName,
      start:s.start,
      end:s.end,
      reason:s.reason,
      items:s.items
    }))
  ));

  return {start,end,days,conflicts};
}

function monthBounds(monthInput){
  const now=new Date();
  let year=now.getFullYear(),month=now.getMonth()+1;
  const m=String(monthInput||"").match(/^(\d{4})-(\d{2})$/);
  if(m){year=Number(m[1]);month=Number(m[2])}
  const first=`${year}-${String(month).padStart(2,"0")}-01`;
  const nextMonth=month===12?`${year+1}-01-01`:`${year}-${String(month+1).padStart(2,"0")}-01`;
  const lastDate=new Date(`${nextMonth}T12:00:00Z`);
  lastDate.setUTCDate(lastDate.getUTCDate()-1);
  return {year,month,first,last:iso(lastDate)};
}

export async function buildMonthPlan(monthInput){
  const {year,month,first,last}=monthBounds(monthInput);
  const events=(await listOccupancyEvents(first,last)).map(normalizeEvent);

  const daysMap=new Map();
  for(const e of events){
    if(!e.event_date)continue;
    if(!daysMap.has(e.event_date))daysMap.set(e.event_date,[]);
    daysMap.get(e.event_date).push(e);
  }

  const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
  const days=[];
  let conflictCount=0;

  for(let day=1;day<=daysInMonth;day++){
    const date=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayEvents=daysMap.get(date)||[];

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

  return {
    month:`${year}-${String(month).padStart(2,"0")}`,
    year,month,
    first,last,
    conflictCount,
    days
  };
}
