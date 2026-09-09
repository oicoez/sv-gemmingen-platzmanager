import { getImportedEvent,updateImportedEventManually,deleteAllImportedGames,createManualCalendarEvent,getManualCalendarEvent,updateManualCalendarEvent,deleteManualCalendarEvent } from "../repositories/event-repository.js";
import { findWholePitch,getPitchDefinition,findPitchResource } from "../repositories/resource-repository.js";
import { matchBlockingMinutes } from "../domain/match-duration.js";
import { getClub } from "../repositories/team-repository.js";

function addMinutes(time,minutes){
  const [h,m]=String(time||"").split(":").map(Number);
  const total=h*60+m+minutes;
  return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}

export async function getGame(id){
  return getImportedEvent(id);
}

export async function editGame(id,input){
  const existing=await getImportedEvent(id);
  if(!existing)throw new Error("Spiel nicht gefunden");

  const date=String(input.date||"").slice(0,10);
  const kickoff=String(input.kickoff||"").slice(0,5);
  const locationId=String(input.locationId||"");
  const baseName=String(input.baseName||"Hauptplatz");

  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Ungültiges Datum");
  if(!/^\d{2}:\d{2}$/.test(kickoff))throw new Error("Ungültige Anstoßzeit");
  if(!["gemmingen","stebbach"].includes(locationId))throw new Error("Ungültiger Spielort");
  if(!["Hauptplatz","Trainingsplatz"].includes(baseName))throw new Error("Ungültiger Platz");

  const resource=await findWholePitch(locationId,baseName);
  if(!resource)throw new Error("Platzressource nicht gefunden");

  const address=locationId==="gemmingen"
    ?"Beim Sportplatz 3, 75050 Gemmingen"
    :"Jahnweg 1, 75050 Gemmingen-Stebbach";

  const venueName=locationId==="gemmingen"?"Gemmingen":"Stebbach";
  const updated=await updateImportedEventManually(id,{
    date,kickoff,endTime:addMinutes(kickoff,matchBlockingMinutes({teamName:existing.team||existing.team_name||existing.title||""})),locationId,venueName,
    resourceId:resource.id,address
  });
  if(!updated)throw new Error("Spiel konnte nicht aktualisiert werden");
  return updated.id;
}


export async function resetImportedGames(){
  return deleteAllImportedGames();
}


function manualType(v){return ["Spiel","Turnier","Training","Platzbelegung","Sonstiges"].includes(v)?v:"Sonstiges"}
function modesForDivision(n){
  if(n===1)return ["exclusive"];
  if(n===3)return ["one_third","two_thirds","exclusive"];
  return ["flexible","half_a","half_b","exclusive"];
}
async function normalizeManual(input){
  const date=String(input.date||"").slice(0,10),start=String(input.start||"").slice(0,5),end=String(input.end||"").slice(0,5);
  const title=String(input.title||"").trim(),teamId=String(input.teamId||"").trim()||null;
  const locationId=String(input.locationId||"").trim(),baseName=String(input.baseName||"").trim();
  let allocationMode=String(input.allocationMode||"exclusive");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Ungültiges Datum");
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||start>=end)throw new Error("Ungültige Uhrzeit");
  if(!title)throw new Error("Titel / Bezeichnung fehlt");
  const def=await getPitchDefinition(locationId,baseName);
  if(!def)throw new Error("Ort / Fläche wurde nicht gefunden");
  const n=Number(def.division_count||1),allowed=modesForDivision(n);
  if(!allowed.includes(allocationMode))allocationMode=allowed[0];
  const section=allocationMode==="half_a"?"half_a":allocationMode==="half_b"?"half_b":"whole";
  const resource=await findPitchResource(locationId,baseName,section);
  if(!resource)throw new Error("Platzressource wurde nicht gefunden");
  return {teamId,date,start,end,title,manualType:manualType(String(input.manualType||"")),
    locationId,baseName,allocationMode,requestedSection:section,resourceId:resource.id,
    venueName:def.location_name||"",address:def.location_address||"",note:String(input.note||"").trim()};
}
export async function addManualEvent(input){
  const club=await getClub();return createManualCalendarEvent({clubId:club.id,...await normalizeManual(input)});
}
export async function getManualEvent(id){return getManualCalendarEvent(id)}
export async function editManualEvent(id,input){
  if(!await getManualCalendarEvent(id))throw new Error("Manueller Termin nicht gefunden");
  const r=await updateManualCalendarEvent(id,await normalizeManual(input));
  if(!r)throw new Error("Termin konnte nicht aktualisiert werden");return r.id;
}
export async function removeManualEvent(id){
  if(!await deleteManualCalendarEvent(id))throw new Error("Manueller Termin nicht gefunden");return true;
}
