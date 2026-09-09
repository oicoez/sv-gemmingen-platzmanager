import { getClub } from "../repositories/team-repository.js";
import { findPitchResource,getResourceById,getPitchDefinition } from "../repositories/resource-repository.js";
import { createTraining,updateTraining,getTraining,deleteTraining,listTrainings } from "../repositories/training-repository.js";

function validateTime(start,end){
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||start>=end)throw new Error("Trainingszeit ist ungültig");
}
async function validateCabin(cabinId,locationId){
  if(!cabinId)return null;
  const r=await getResourceById(cabinId);
  if(!r||r.resource_type!=="cabin"||r.location_id!==locationId)throw new Error("Ungültige Kabine");
  return r;
}
function modesForDivision(n){
  if(n===1)return new Set(["exclusive","flexible"]);
  if(n===3)return new Set(["one_third","two_thirds","exclusive"]);
  return new Set(["flexible","half_a","half_b","exclusive"]);
}
async function normalizeInput(input){
  const {teamId,date,start,end,locationId,baseName,allocationMode="flexible",cabin1Id=null,cabin2Id=null,note=""}=input;
  if(!teamId||!date)throw new Error("Mannschaft und Datum sind erforderlich");
  const def=await getPitchDefinition(locationId,baseName);
  if(!def)throw new Error("Trainingsort oder Platz wurde nicht gefunden");
  const div=Number(def.division_count||1);
  if(!modesForDivision(div).has(allocationMode))throw new Error("Diese Belegung passt nicht zur Teilbarkeit des Trainingsortes");
  validateTime(start,end);
  if(cabin1Id&&cabin2Id&&cabin1Id===cabin2Id)throw new Error("Dieselbe Kabine kann nicht doppelt gewählt werden");
  await validateCabin(cabin1Id,locationId);await validateCabin(cabin2Id,locationId);

  const section=allocationMode==="half_a"?"half_a":allocationMode==="half_b"?"half_b":"whole";
  const resource=await findPitchResource(locationId,baseName,section);
  if(!resource)throw new Error("Platzressource wurde nicht gefunden");
  return {teamId,date,start,end,locationId,baseName,allocationMode,note,cabin1Id:cabin1Id||null,cabin2Id:cabin2Id||null,
    requestedSection:section,resourceId:resource.id,address:def.location_address||""};
}
export async function addTraining(input){const club=await getClub();return createTraining({clubId:club.id,...await normalizeInput(input)});}
export async function editTraining(id,input){
  if(!await getTraining(id))throw new Error("Training nicht gefunden");
  const updated=await updateTraining(id,await normalizeInput(input));
  if(!updated)throw new Error("Training konnte nicht aktualisiert werden");
  return updated.id;
}
export {getTraining,deleteTraining,listTrainings};
