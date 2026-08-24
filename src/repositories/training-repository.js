import crypto from "crypto";
import { db } from "../database/client.js";

export async function createTraining(input){
  const id=crypto.randomUUID();
  await db(`insert into cp5_events(
    id,club_id,team_id,event_type,event_date,kickoff_time,start_time,end_time,title,
    opponent,competition,status,location_id,venue_name,resource_id,allocation_mode,requested_section,
    home_cabin_id,guest_cabin_id,address,note,source,created_at,updated_at
  ) values(
    $1,$2,$3,'training',$4,$5,$5,$6,'Training','','Training','planned',$7,'',$8,$9,$10,
    $11,$12,$13,$14,'manual',now(),now()
  )`,[
    id,input.clubId,input.teamId,input.date,input.start,input.end,input.locationId,input.resourceId,
    input.allocationMode,input.requestedSection,input.cabin1Id||null,input.cabin2Id||null,
    input.address||"",input.note||""
  ]);
  return id;
}

export async function updateTraining(id,input){
  const q=await db(`update cp5_events set
      team_id=$2,event_date=$3,kickoff_time=$4,start_time=$4,end_time=$5,
      location_id=$6,resource_id=$7,allocation_mode=$8,requested_section=$9,
      home_cabin_id=$10,guest_cabin_id=$11,address=$12,note=$13,updated_at=now()
    where id=$1 and event_type='training'
    returning id`,[
      id,input.teamId,input.date,input.start,input.end,input.locationId,input.resourceId,
      input.allocationMode,input.requestedSection,input.cabin1Id||null,input.cabin2Id||null,
      input.address||"",input.note||""
    ]);
  return q.rows[0]||null;
}

export async function getTraining(id){
  const q=await db(`select e.*,t.name as team_name,r.base_name as pitch_base
    from cp5_events e
    left join cp5_teams t on t.id=e.team_id
    left join cp5_resources r on r.id=e.resource_id
    where e.id=$1 and e.event_type='training' limit 1`,[id]);
  return q.rows[0]||null;
}

export async function deleteTraining(id){
  const q=await db(`delete from cp5_events where id=$1 and event_type='training' returning id`,[id]);
  return q.rowCount>0;
}

export async function listTrainings({from,to}){
  const q=await db(`select e.id,e.event_date,e.start_time,e.end_time,e.title,e.note,
      e.location_id,e.resource_id,e.allocation_mode,e.requested_section,
      e.home_cabin_id,e.guest_cabin_id,
      t.name as team,r.base_name,r.section,r.display_name as resource,l.name as location,
      c1.base_name as cabin1_base,c1.display_name as cabin1_name,
      c2.base_name as cabin2_base,c2.display_name as cabin2_name
    from cp5_events e
    join cp5_teams t on t.id=e.team_id
    left join cp5_resources r on r.id=e.resource_id
    left join cp5_resources c1 on c1.id=e.home_cabin_id
    left join cp5_resources c2 on c2.id=e.guest_cabin_id
    left join cp5_locations l on l.id=e.location_id
    where e.event_type='training' and e.event_date between $1 and $2
    order by e.event_date,e.start_time,t.name`,[from,to]);
  return q.rows.map(x=>({
    ...x,
    cabin1_label:x.cabin1_base==="Heimkabine"?"Kabine 1":x.cabin1_name||"",
    cabin2_label:x.cabin2_base==="Gastkabine"?"Kabine 2":x.cabin2_name||""
  }));
}
