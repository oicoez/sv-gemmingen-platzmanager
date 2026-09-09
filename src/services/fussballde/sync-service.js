import crypto from "crypto";
import { db } from "../../database/client.js";
import { logger } from "../../utils/logger.js";
import { loadClubMatchplans,loadGameDetail } from "./matchplan-client.js";
import { parseSeasonMatchplan,isClubHomeTeam } from "./matchplan-parser.js";
import { parseVenue } from "./detail-parser.js";
import { getClub } from "../../repositories/team-repository.js";
import { findActiveTeamForFixture } from "../team-service.js";
import { findWholePitch } from "../../repositories/resource-repository.js";
import { upsertImportedEvent, deleteConfirmedExternalEvents } from "../../repositories/event-repository.js";

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
      if(row.status==="cancelled")return {...row,venue:{locationId:null,venueName:"abgesetzt",address:"",pitchBase:""}};
      try{return {...row,venue:parseVenue(await loadGameDetail(row.url))}}
      catch(e){return {...row,venue:{locationId:null,venueName:"",address:"",pitchBase:""},venueError:e.name==="AbortError"?"Timeout":e.message}}
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
      const plans=await loadClubMatchplans();
      const parsed=[];
      for(const plan of plans){
        if(plan.error||!plan.html)continue;
        for(const row of parseSeasonMatchplan(plan.html,plan.url)){
          parsed.push({...row,sourceClub:plan.sourceClub,sourceKind:plan.sourceKind||"ajax"});
        }
      }

      function fixtureKey(row){
        return row.gameNumber?`game:${row.gameNumber}`:`ext:${row.externalId}`;
      }
      function sourcePriority(row){
        if(row.sourceClub==="gemmingen" && row.sourceKind==="visible")return 400;
        if(row.sourceClub==="stebbach" && row.sourceKind==="visible")return 300;
        if(row.sourceClub==="gemmingen" && row.sourceKind==="ajax")return 200;
        if(row.sourceClub==="stebbach" && row.sourceKind==="ajax")return 100;
        return 0;
      }

      const merged=new Map();
      for(const row of parsed){
        const key=fixtureKey(row);
        if(!key)continue;
        const current=merged.get(key);
        if(!current || sourcePriority(row)>sourcePriority(current))merged.set(key,row);
      }
      const all=[...merged.values()];
      const candidateHome=all.filter(x=>isClubHomeTeam(x.home));
      const candidateAway=all.filter(x=>isClubHomeTeam(x.away));

      const homeAll=[];
      const unmatchedHome=[];
      for(const row of candidateHome){
        const team=await findActiveTeamForFixture(club.id,{category:row.category,externalName:row.home});
        if(team)homeAll.push({...row,matchedTeamId:team.id});
        else unmatchedHome.push({date:row.date,kickoff:row.kickoff,category:row.category,home:row.home,away:row.away,gameNumber:row.gameNumber});
      }

      const awayAll=[];
      for(const row of candidateAway){
        const team=await findActiveTeamForFixture(club.id,{category:row.category,externalName:row.away});
        if(team)awayAll.push({...row,matchedTeamId:team.id});
      }

      // Echte Auswärtsspiele werden nicht importiert, müssen aber zur
      // Bereinigung alter falscher Heimspiel-Datensätze geprüft werden.
      const removedTrueAway=await deleteConfirmedExternalEvents(
        awayAll.map(row=>({
          externalId:row.externalId,
          date:row.date,
          home:row.away,
          away:row.home
        }))
      );

      const upcomingCount=homeAll.filter(isUpcomingFixture).length;
      const past=homeAll.length-upcomingCount;
      state.total=homeAll.length;
      state.progress=`${all.length} Spiele gefunden · ${homeAll.length} Spiele aktiver Mannschaften · ${upcomingCount} kommende Heimspiele · ${awayAll.length} Auswärtsspiele geprüft${unmatchedHome.length?` · ${unmatchedHome.length} Mannschaftsnamen nicht zugeordnet`:""}`;
      logger.info("FUSSBALL.DE Spielplan geladen",{
        sources:plans.map(x=>({sourceClub:x.sourceClub,ok:!x.error,error:x.error||""})),
        parsed:parsed.length,merged:all.length,homeAll:homeAll.length,awayAll:awayAll.length,
        unmatchedHome,removedTrueAway,upcoming:upcomingCount,pastHidden:past
      });

      state.phase="venues";
      state.progress="Spielorte/Adressen werden aus den offiziellen Spielseiten geprüft …";
      const enrichedRows=await enrichVenues(homeAll);

      // Für den Platzmanager sind nur Spiele relevant, die tatsächlich
      // in Gemmingen oder Stebbach stattfinden. FUSSBALL.DE kann unsere
      // Mannschaft trotzdem als "Heim" führen, obwohl auf neutralem Platz gespielt wird.
      const confirmedExternal=enrichedRows.filter(row=>
        row.status!=="cancelled" &&
        !row.venueError &&
        !row.venue?.locationId &&
        Boolean(row.venue?.venueName)
      );
      const rows=enrichedRows.filter(row=>
        row.status==="cancelled" ||
        row.venue?.locationId==="gemmingen" ||
        row.venue?.locationId==="stebbach"
      );

      const removedExternal=await deleteConfirmedExternalEvents(
        confirmedExternal.map(row=>({
          externalId:row.externalId,
          date:row.date,
          home:row.home,
          away:row.away
        }))
      );

      state.total=rows.length;
      state.phase="database";
      state.progress=`${rows.length} lokale/abgesetzte Spiele · ${confirmedExternal.length} externe Spielorte ausgeschlossen`;
      logger.info("Externe Spielorte ausgeschlossen / Alt-Datensätze bereinigt",{
        external:confirmedExternal.length,
        removedExisting:removedExternal,
        examples:confirmedExternal.slice(0,5).map(r=>({
          date:r.date,team:r.home,opponent:r.away,venue:r.venue?.venueName,address:r.venue?.address
        }))
      });

      for(const row of rows){
        state.processed++;
        if(!row.date||!row.kickoff||!row.home||!row.away){state.skipped++;state.errors.push(`${row.externalId}: Pflichtdaten fehlen`);continue}
        try{
          const teamId=row.matchedTeamId;
          if(!teamId){state.skipped++;continue}
          const resource=await findWholePitch(row.venue.locationId,row.venue.pitchBase||"Hauptplatz");
          const saved=await upsertImportedEvent({
            clubId:club.id,teamId,date:row.date,kickoff:row.kickoff,endTime:addMinutes(row.kickoff,120),
            title:`${row.home} – ${row.away}`,opponent:row.away,competition:row.competition,status:row.status,
            locationId:row.venue.locationId,venueName:row.venue.venueName||"",resourceId:resource?.id||null,address:row.venue.address||"",
            externalId:row.externalId,externalUrl:row.url,gameNumber:row.gameNumber||""
          });
          state[saved.action]++;
          if(row.venueError)state.errors.push(`${row.externalId}: Spielort ${row.venueError}`);
          logger.info("FUSSBALL.DE Spiel verarbeitet",{n:state.processed,total:state.total,gameNumber:row.gameNumber,sourceClub:row.sourceClub,sourceKind:row.sourceKind,date:row.date,kickoff:row.kickoff,team:row.home,opponent:row.away,location:row.venue.locationId||row.venue.venueName,status:row.status,action:saved.action});
        }catch(e){state.skipped++;state.errors.push(`${row.externalId}: ${e.message}`);logger.error("FUSSBALL.DE Spiel fehlgeschlagen",{externalId:row.externalId,message:e.message})}
      }
      state.phase="done";
      state.progress=`Fertig: ${state.inserted} neu · ${state.updated} aktualisiert · ${state.unchanged} unverändert · ${state.skipped} übersprungen · ${confirmedExternal.length} externe Spielorte ausgeblendet`;
      await db(`update cp5_sync_runs set status='success',finished_at=now(),found_count=$2,inserted_count=$3,updated_count=$4,unchanged_count=$5,skipped_count=$6,error_count=$7,details=$8 where id=$1`,[runId,state.total,state.inserted,state.updated,state.unchanged,state.skipped,state.errors.length,JSON.stringify({errors:state.errors,externalExcluded:confirmedExternal.length,removedExternal,removedTrueAway})]);
    }catch(e){
      state.phase="error";state.progress=`Fehler: ${e.message}`;state.errors.push(e.message);
      await db(`update cp5_sync_runs set status='error',finished_at=now(),error_count=$2,details=$3 where id=$1`,[runId,state.errors.length,JSON.stringify({errors:state.errors})]).catch(()=>{});
      logger.error("FUSSBALL.DE Sync fehlgeschlagen",{message:e.message,stack:e.stack});
    }finally{state.running=false;state.finishedAt=new Date().toISOString()}
  })();
  return true;
}
