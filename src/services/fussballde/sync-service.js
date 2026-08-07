import crypto from "crypto";
import { db } from "../../database/client.js";
import { logger } from "../../utils/logger.js";
import { loadSeasonMatchplan,loadGameDetail } from "./matchplan-client.js";
import { parseSeasonMatchplan,isClubHomeTeam } from "./matchplan-parser.js";
import { parseVenue } from "./detail-parser.js";
import { ensureImportedTeam,getClub } from "../../repositories/team-repository.js";
import { findWholePitch } from "../../repositories/resource-repository.js";
import { upsertImportedEvent } from "../../repositories/event-repository.js";

const state={running:false,phase:"idle",progress:"Noch nicht synchronisiert",total:0,processed:0,inserted:0,updated:0,unchanged:0,skipped:0,errors:[],startedAt:null,finishedAt:null};
export function getSyncState(){return {...state,errors:[...state.errors]}}


function berlinNowParts(){
  const parts=new Intl.DateTimeFormat("sv-SE",{
    timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date());
  const get=t=>parts.find(x=>x.type===t)?.value||"";
  return {date:`${get("year")}-${get("month")}-${get("day")}`,time:`${get("hour")}:${get("minute")}`};
}

function isUpcomingFixture(row){
  if(!row.date||!row.kickoff)return false;
  const now=berlinNowParts();
  return row.date>now.date || (row.date===now.date && row.kickoff>=now.time);
}

function addMinutes(time,minutes){
  if(!time)return null;
  const [h,m]=time.split(":").map(Number);const total=(h*60+m+minutes)%(24*60);
  return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}

async function enrichVenues(rows){
  const result=[];const concurrency=5;
  for(let offset=0;offset<rows.length;offset+=concurrency){
    const batch=rows.slice(offset,offset+concurrency);
    const items=await Promise.all(batch.map(async row=>{
      if(row.status==="cancelled")return {...row,venue:{locationId:null,address:"",pitchBase:""}};
      try{return {...row,venue:parseVenue(await loadGameDetail(row.url))}}
      catch(e){return {...row,venue:{locationId:null,address:"",pitchBase:""},venueError:e.name==="AbortError"?"Timeout":e.message}}
    }));
    result.push(...items);
  }
  return result;
}

export async function startFussballSync(){
  if(state.running)return false;
  Object.assign(state,{running:true,phase:"matchplan",progress:"Vereinsspielplan wird geladen …",total:0,processed:0,inserted:0,updated:0,unchanged:0,skipped:0,errors:[],startedAt:new Date().toISOString(),finishedAt:null});
  const runId=crypto.randomUUID();
  await db(`insert into cp5_sync_runs(id,source,status) values($1,'fussballde','running')`,[runId]);
  (async()=>{
    try{
      const club=await getClub();
      const {url,html}=await loadSeasonMatchplan();
      const all=parseSeasonMatchplan(html,url);
      const homeAll=all.filter(x=>isClubHomeTeam(x.home));
      const home=homeAll.filter(isUpcomingFixture);
      const past=homeAll.length-home.length;
      state.total=home.length;
      state.progress=`${all.length} Spiele gefunden · ${home.length} kommende Heimspiele · ${past} vergangene ausgeblendet`;
      logger.info("FUSSBALL.DE Spielplan geladen",{all:all.length,homeAll:homeAll.length,upcoming:home.length,pastSkipped:past});

      state.phase="venues";
      state.progress="Spielorte/Adressen der kommenden Spiele werden ergänzt …";
      const rows=await enrichVenues(home);

      state.phase="database";
      for(const row of rows){
        state.processed++;
        if(!row.date||!row.kickoff||!row.home||!row.away){state.skipped++;state.errors.push(`${row.externalId}: Pflichtdaten fehlen`);continue}
        try{
          const team=await ensureImportedTeam(club.id,{category:row.category,externalName:row.home});
          const resource=await findWholePitch(row.venue.locationId,row.venue.pitchBase||"Hauptplatz");
          const saved=await upsertImportedEvent({
            clubId:club.id,teamId:team.id,date:row.date,kickoff:row.kickoff,endTime:addMinutes(row.kickoff,120),
            title:`${row.home} – ${row.away}`,opponent:row.away,competition:row.competition,status:row.status,
            locationId:row.venue.locationId,resourceId:resource?.id||null,address:row.venue.address||"",
            externalId:row.externalId,externalUrl:row.url,gameNumber:row.gameNumber||""
          });
          state[saved.action]++;
          if(row.venueError)state.errors.push(`${row.externalId}: Spielort ${row.venueError}`);
          logger.info("FUSSBALL.DE Spiel verarbeitet",{n:state.processed,total:state.total,date:row.date,kickoff:row.kickoff,team:row.home,opponent:row.away,location:row.venue.locationId,status:row.status,action:saved.action});
        }catch(e){state.skipped++;state.errors.push(`${row.externalId}: ${e.message}`);logger.error("FUSSBALL.DE Spiel fehlgeschlagen",{externalId:row.externalId,message:e.message})}
      }
      state.phase="done";
      state.progress=`Fertig: ${state.inserted} neu · ${state.updated} aktualisiert · ${state.unchanged} unverändert · ${state.skipped} übersprungen`;
      await db(`update cp5_sync_runs set status='success',finished_at=now(),found_count=$2,inserted_count=$3,updated_count=$4,unchanged_count=$5,skipped_count=$6,error_count=$7,details=$8 where id=$1`,[runId,state.total,state.inserted,state.updated,state.unchanged,state.skipped,state.errors.length,JSON.stringify({errors:state.errors})]);
    }catch(e){
      state.phase="error";state.progress=`Fehler: ${e.message}`;state.errors.push(e.message);
      await db(`update cp5_sync_runs set status='error',finished_at=now(),error_count=$2,details=$3 where id=$1`,[runId,state.errors.length,JSON.stringify({errors:state.errors})]).catch(()=>{});
      logger.error("FUSSBALL.DE Sync fehlgeschlagen",{message:e.message,stack:e.stack});
    }finally{state.running=false;state.finishedAt=new Date().toISOString()}
  })();
  return true;
}
