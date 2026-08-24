import { db } from "../database/client.js";

export async function listOccupancyEvents(from,to){
  const q=await db(`select e.id,e.event_type,e.event_date,e.start_time,e.end_time,e.kickoff_time,
      e.title,e.opponent,e.competition,e.status,e.location_id,e.resource_id,
      e.allocation_mode,e.requested_section,e.address,e.note,
      e.home_cabin_id,e.guest_cabin_id,
      t.name as team,r.base_name,r.section as resource_section,r.display_name as resource,
      l.name as location,
      c1.base_name as cabin1_base,c2.base_name as cabin2_base
    from cp5_events e
    left join cp5_teams t on t.id=e.team_id
    left join cp5_resources r on r.id=e.resource_id
    left join cp5_resources c1 on c1.id=e.home_cabin_id
    left join cp5_resources c2 on c2.id=e.guest_cabin_id
    left join cp5_locations l on l.id=e.location_id
    where e.event_date between $1 and $2
      and e.location_id in ('gemmingen','stebbach')
      and e.resource_id is not null
      and e.status <> 'cancelled'
      and e.event_type in ('training','home_match')
    order by e.event_date,e.start_time,e.kickoff_time`,[from,to]);
  return q.rows;
}
