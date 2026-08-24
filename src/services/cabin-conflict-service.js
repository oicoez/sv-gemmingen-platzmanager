import { eventStart,eventEnd,hhmm } from "../domain/allocation-engine.js";

function cabinIds(e){
  return [e.home_cabin_id,e.guest_cabin_id].filter(Boolean);
}
function overlaps(a,b){
  const as=eventStart(a),ae=eventEnd(a),bs=eventStart(b),be=eventEnd(b);
  return Number.isFinite(as)&&Number.isFinite(ae)&&Number.isFinite(bs)&&Number.isFinite(be)
    && as<be && ae>bs;
}
function label(e){
  return e.event_type==="home_match"
    ? `Spiel ${e.team||""}${e.opponent?` – ${e.opponent}`:""}`
    : `Training ${e.team||""}`;
}

export function findCabinConflicts(events){
  const result=[];
  for(let i=0;i<events.length;i++){
    for(let j=i+1;j<events.length;j++){
      const a=events[i],b=events[j];
      if(a.location_id!==b.location_id)continue;
      if(String(a.event_date).slice(0,10)!==String(b.event_date).slice(0,10))continue;
      if(!overlaps(a,b))continue;

      const shared=cabinIds(a).filter(id=>cabinIds(b).includes(id));
      if(!shared.length)continue;

      const start=Math.max(eventStart(a),eventStart(b));
      const end=Math.min(eventEnd(a),eventEnd(b));
      for(const cabinId of shared){
        const cabinBase =
          (a.home_cabin_id===cabinId?a.cabin1_base:a.cabin2_base) ||
          (b.home_cabin_id===cabinId?b.cabin1_base:b.cabin2_base) || "Kabine";
        result.push({
          type:"cabin",
          date:String(a.event_date).slice(0,10),
          start:hhmm(start),end:hhmm(end),
          location:a.location,
          cabinId,
          cabinLabel:cabinBase==="Heimkabine"?"Kabine 1":"Kabine 2",
          reason:`${cabinBase==="Heimkabine"?"Kabine 1":"Kabine 2"} ist gleichzeitig doppelt belegt.`,
          items:[
            {id:a.id,eventType:a.event_type,label:label(a)},
            {id:b.id,eventType:b.event_type,label:label(b)}
          ]
        });
      }
    }
  }
  return result;
}
