const mins=t=>{
  const m=String(t||"").match(/^(\d{1,2}):(\d{2})/);
  return m?Number(m[1])*60+Number(m[2]):null;
};
export const hhmm=n=>`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
export const eventStart=e=>mins(e.start_time||e.kickoff_time);
export function eventEnd(e){
  const x=mins(e.end_time);
  if(x!==null)return x;
  const st=eventStart(e);
  return st===null?null:st+(e.event_type==="home_match"?120:90);
}
function stableSort(events){
  return [...events].sort((a,b)=>{
    const sa=eventStart(a)??0,sb=eventStart(b)??0;
    return sa-sb || String(a.team||a.title||"").localeCompare(String(b.team||b.title||""),"de");
  });
}

export function allocateInterval(active){
  const events=stableSort(active);
  if(!events.length)return {items:[],conflict:false,reason:""};

  const games=events.filter(e=>e.event_type==="home_match");
  if(games.length){
    if(events.length===1){
      return {items:[{event:events[0],section:"whole",sectionLabel:"Gesamt"}],conflict:false,reason:""};
    }
    return {
      items:events.map(e=>({event:e,section:"whole",sectionLabel:"Gesamt"})),
      conflict:true,
      reason:"Spiel und weitere Belegung überschneiden sich auf demselben Platz."
    };
  }

  if(events.length>2){
    return {
      items:events.map(e=>({event:e,section:"conflict",sectionLabel:"Konflikt"})),
      conflict:true,
      reason:"Mehr als zwei Mannschaften gleichzeitig auf demselben Platz."
    };
  }

  if(events.length===1){
    const e=events[0];
    if(e.allocation_mode==="half_a"||e.requested_section==="half_a")
      return {items:[{event:e,section:"half_a",sectionLabel:"Hälfte A"}],conflict:false,reason:""};
    if(e.allocation_mode==="half_b"||e.requested_section==="half_b")
      return {items:[{event:e,section:"half_b",sectionLabel:"Hälfte B"}],conflict:false,reason:""};
    return {items:[{event:e,section:"whole",sectionLabel:"Gesamt"}],conflict:false,reason:""};
  }

  const exclusive=events.find(e=>e.allocation_mode==="exclusive");
  if(exclusive){
    return {
      items:events.map(e=>({event:e,section:"whole",sectionLabel:"Gesamt"})),
      conflict:true,
      reason:"Eine Mannschaft hat den Gesamtplatz exklusiv gebucht."
    };
  }

  const fixedA=events.filter(e=>e.allocation_mode==="half_a"||e.requested_section==="half_a");
  const fixedB=events.filter(e=>e.allocation_mode==="half_b"||e.requested_section==="half_b");
  if(fixedA.length===2||fixedB.length===2){
    return {
      items:events.map(e=>({event:e,section:"conflict",sectionLabel:"Konflikt"})),
      conflict:true,
      reason:"Beide Mannschaften haben dieselbe Platzhälfte fest gebucht."
    };
  }

  if(fixedA.length===1){
    const other=events.find(e=>e.id!==fixedA[0].id);
    return {items:[
      {event:fixedA[0],section:"half_a",sectionLabel:"Hälfte A"},
      {event:other,section:"half_b",sectionLabel:"Hälfte B"}
    ],conflict:false,reason:""};
  }
  if(fixedB.length===1){
    const other=events.find(e=>e.id!==fixedB[0].id);
    return {items:[
      {event:other,section:"half_a",sectionLabel:"Hälfte A"},
      {event:fixedB[0],section:"half_b",sectionLabel:"Hälfte B"}
    ],conflict:false,reason:""};
  }

  const [a,b]=events;
  return {items:[
    {event:a,section:"half_a",sectionLabel:"Hälfte A"},
    {event:b,section:"half_b",sectionLabel:"Hälfte B"}
  ],conflict:false,reason:""};
}

export function buildSegments(events){
  const boundaries=[...new Set(events.flatMap(e=>[eventStart(e),eventEnd(e)]).filter(Number.isFinite))].sort((a,b)=>a-b);
  const out=[];
  for(let i=0;i<boundaries.length-1;i++){
    const start=boundaries[i],end=boundaries[i+1];
    if(end<=start)continue;
    const active=events.filter(e=>eventStart(e)<end && eventEnd(e)>start);
    if(!active.length)continue;
    const allocation=allocateInterval(active);
    const seg={
      start:hhmm(start),end:hhmm(end),
      conflict:allocation.conflict,reason:allocation.reason,
      items:allocation.items.map(x=>({
        id:x.event.id,eventType:x.event.event_type,team:x.event.team||"",
        title:x.event.title||"",opponent:x.event.opponent||"",
        label:x.event.event_type==="home_match"
          ? `${x.event.team||x.event.title}${x.event.opponent?` – ${x.event.opponent}`:""}`
          : (x.event.team||x.event.title||"Training"),
        section:x.section,sectionLabel:x.sectionLabel
      }))
    };
    const signature=o=>JSON.stringify({
      conflict:o.conflict,
      items:o.items.map(i=>[i.id,i.section]).sort()
    });
    const prev=out[out.length-1];
    if(prev&&prev.end===seg.start&&signature(prev)===signature(seg))prev.end=seg.end;
    else out.push(seg);
  }
  return out;
}
