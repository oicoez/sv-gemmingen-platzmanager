import { buildWeekPlan } from "./planner-service.js";

export async function buildWeeklyDashboard(){
  const week=await buildWeekPlan();
  const items=[];
  for(const day of week.days){
    for(const group of day.groups){
      for(const segment of group.segments){
        for(const item of segment.items){
          items.push({
            date:day.date,start:segment.start,end:segment.end,
            location:group.location,baseName:group.baseName,
            conflict:segment.conflict,reason:segment.reason,
            eventType:item.eventType,label:item.label,sectionLabel:item.sectionLabel,
            id:item.id
          });
        }
      }
    }
  }

  // De-duplicate the same event when a flexible overlap creates several segments.
  const eventMap=new Map();
  for(const i of items){
    const key=i.id;
    if(!eventMap.has(key)){
      eventMap.set(key,{...i,segments:[{start:i.start,end:i.end,sectionLabel:i.sectionLabel,conflict:i.conflict}]});
    }else{
      const old=eventMap.get(key);
      old.segments.push({start:i.start,end:i.end,sectionLabel:i.sectionLabel,conflict:i.conflict});
      old.conflict=old.conflict||i.conflict;
      if(!old.reason&&i.reason)old.reason=i.reason;
    }
  }
  const events=[...eventMap.values()].sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  return {
    weekStart:week.start,weekEnd:week.end,
    games:events.filter(x=>x.eventType==="home_match").length,
    trainings:events.filter(x=>x.eventType==="training").length,
    conflicts:week.conflicts.length,
    events,conflictDetails:week.conflicts
  };
}
