import { getClub } from "../repositories/team-repository.js";
import { findPitchResource,getResourceById } from "../repositories/resource-repository.js";
import { createTraining,updateTraining,getTraining,deleteTraining,listTrainings } from "../repositories/training-repository.js";

const validModes=new Set(["flexible","half_a","half_b","exclusive"]);
const validLocations=new Set(["gemmingen","stebbach"]);
const validBases=new Set(["Hauptplatz","Trainingsplatz"]);

function validateTime(start,end){
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||start>=end)
    throw new Error("Trainingszeit ist ungültig");
}

async function validateCabin(cabinId,locationId){
  if(!cabinId)return null;
  const r=await getResourceById(cabinId);
  if(!r||r.resource_type!=="cabin")throw new Error("Ungültige Kabine");
  if(r.location_id!==locationId)throw new Error("Die gewählte Kabine gehört zu einem anderen Standort");
  return r;
}

async function normalizeInput(input){
  const {
    teamId,date,start,end,locationId,baseName,allocationMode="flexible",
    cabin1Id=null,cabin2Id=null,note=""
  }=input;
  if(!teamId||!date)throw new Error("Mannschaft und Datum sind erforderlich");
  if(!validLocations.has(locationId))throw new Error("Ungültiger Ort");
  if(!validBases.has(baseName))throw new Error("Ungültiger Platz");
  if(!validModes.has(allocationMode))throw new Error("Ungültige Platzbelegung");
  validateTime(start,end);
  if(cabin1Id&&cabin2Id&&cabin1Id===cabin2Id)throw new Error("Dieselbe Kabine kann nicht doppelt gewählt werden");

  await validateCabin(cabin1Id,locationId);
  await validateCabin(cabin2Id,locationId);

  const section=allocationMode==="half_a"?"half_a":allocationMode==="half_b"?"half_b":"whole";
  const resource=await findPitchResource(locationId,baseName,section);
  if(!resource)throw new Error("Platzressource wurde nicht gefunden");

  const address=locationId==="gemmingen"
    ?"Beim Sportplatz 3, 75050 Gemmingen"
    :"Jahnweg 1, 75050 Gemmingen-Stebbach";

  return {
    teamId,date,start,end,locationId,baseName,allocationMode,note,
    cabin1Id:cabin1Id||null,cabin2Id:cabin2Id||null,
    requestedSection:section,resourceId:resource.id,address
  };
}

export async function addTraining(input){
  const club=await getClub();
  const normalized=await normalizeInput(input);
  return createTraining({clubId:club.id,...normalized});
}

export async function editTraining(id,input){
  const existing=await getTraining(id);
  if(!existing)throw new Error("Training nicht gefunden");
  const normalized=await normalizeInput(input);
  const updated=await updateTraining(id,normalized);
  if(!updated)throw new Error("Training konnte nicht aktualisiert werden");
  return updated.id;
}

export {getTraining,deleteTraining,listTrainings};
