import { getImportedEvent,updateImportedEventManually } from "../repositories/event-repository.js";
import { findWholePitch } from "../repositories/resource-repository.js";

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
    date,kickoff,endTime:addMinutes(kickoff,120),locationId,venueName,
    resourceId:resource.id,address
  });
  if(!updated)throw new Error("Spiel konnte nicht aktualisiert werden");
  return updated.id;
}
