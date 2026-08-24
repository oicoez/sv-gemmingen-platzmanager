import { db } from "../database/client.js";

export async function listResources(){
  const q=await db(`select r.id,r.location_id,l.name location_name,l.address,
      r.resource_type,r.base_name,r.section,r.display_name
    from cp5_resources r
    join cp5_locations l on l.id=r.location_id
    where r.active=true and l.active=true
    order by case l.id when 'gemmingen' then 1 when 'stebbach' then 2 else 9 end,
      case r.resource_type when 'pitch' then 1 else 2 end,
      r.base_name,
      case r.section when 'whole' then 1 when 'half_a' then 2 when 'half_b' then 3 else 9 end`);
  return q.rows.map(r=>({
    ...r,
    ui_name:r.resource_type==="cabin"
      ? (r.base_name==="Heimkabine"?"Kabine 1 (Heim)":"Kabine 2 (Gast)")
      : r.display_name
  }));
}

export async function resourceOverview(){
  const rows=await listResources();
  const locations=[];
  for(const locationId of ["gemmingen","stebbach"]){
    const mine=rows.filter(x=>x.location_id===locationId);
    const first=mine[0];
    if(!first)continue;
    const pitchBases=["Hauptplatz","Trainingsplatz"].map(base=>({
      baseName:base,
      whole:mine.find(x=>x.resource_type==="pitch"&&x.base_name===base&&x.section==="whole")||null,
      halfA:mine.find(x=>x.resource_type==="pitch"&&x.base_name===base&&x.section==="half_a")||null,
      halfB:mine.find(x=>x.resource_type==="pitch"&&x.base_name===base&&x.section==="half_b")||null
    }));
    const cabins=mine.filter(x=>x.resource_type==="cabin").map(x=>({
      id:x.id,name:x.ui_name,baseName:x.base_name
    }));
    locations.push({
      id:locationId,
      name:first.location_name,
      address:first.address,
      pitches:pitchBases,
      cabins
    });
  }
  return {locations};
}
