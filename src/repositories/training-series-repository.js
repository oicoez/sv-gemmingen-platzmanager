import crypto from "crypto";
import { db } from "../database/client.js";
export async function createSeries(x){
  const id=crypto.randomUUID();
  await db(`insert into cp5_training_series(
    id,club_id,team_id,recurrence_type,weekday,month_ordinal,start_date,end_date,start_time,end_time,
    location_id,base_name,allocation_mode,cabin1_id,cabin2_id,note,active
  ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)`,
  [id,x.clubId,x.teamId,x.recurrenceType,x.weekday,x.monthOrdinal||null,x.startDate,x.endDate||null,
   x.start,x.end,x.locationId,x.baseName,x.allocationMode,x.cabin1Id||null,x.cabin2Id||null,x.note||""]);
  return id;
}
export async function listSeries(){
  const q=await db(`select s.*,t.name team,l.name location from cp5_training_series s
    left join cp5_teams t on t.id=s.team_id left join cp5_locations l on l.id=s.location_id
    where s.active=true order by s.start_date,s.weekday,s.start_time,t.name`);
  return q.rows;
}
export async function getSeries(id){
  const q=await db(`select * from cp5_training_series where id=$1 and active=true limit 1`,[id]);
  return q.rows[0]||null;
}
export async function deactivateSeries(id){
  const q=await db(`update cp5_training_series set active=false,updated_at=now() where id=$1 returning id`,[id]);
  return q.rowCount>0;
}
