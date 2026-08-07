import { getClub } from "../repositories/team-repository.js";
import { findPitchResource } from "../repositories/resource-repository.js";
import { createTraining,deleteTraining,listTrainings } from "../repositories/training-repository.js";
const validModes=new Set(["flexible","half_a","half_b","exclusive"]);
const validLocations=new Set(["gemmingen","stebbach"]);
const validBases=new Set(["Hauptplatz","Trainingsplatz"]);
export async function addTraining(input){
  const {teamId,date,start,end,locationId,baseName,allocationMode="flexible",note=""}=input;
  if(!teamId||!date)throw new Error("Mannschaft und Datum sind erforderlich");
  if(!validLocations.has(locationId))throw new Error("Ungültiger Ort");
  if(!validBases.has(baseName))throw new Error("Ungültiger Platz");
  if(!validModes.has(allocationMode))throw new Error("Ungültige Platzbelegung");
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||start>=end)throw new Error("Trainingszeit ist ungültig");
  const club=await getClub();
  const section=allocationMode==="half_a"?"half_a":allocationMode==="half_b"?"half_b":"whole";
  const resource=await findPitchResource(locationId,baseName,section);
  if(!resource)throw new Error("Platzressource wurde nicht gefunden");
  const address=locationId==="gemmingen"?"Beim Sportplatz 3, 75050 Gemmingen":"Jahnweg 1, 75050 Gemmingen-Stebbach";
  return createTraining({clubId:club.id,teamId,date,start,end,locationId,resourceId:resource.id,allocationMode,requestedSection:section,address,note});
}
export {deleteTraining,listTrainings};
