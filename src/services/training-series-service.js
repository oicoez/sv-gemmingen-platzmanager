import { db } from "../database/client.js";
import { getClub } from "../repositories/team-repository.js";
import { findPitchResource,getResourceById } from "../repositories/resource-repository.js";
import { createSeries,listSeries,getSeries,deactivateSeries } from "../repositories/training-series-repository.js";
import { createTraining } from "../repositories/training-repository.js";
import { generateOccurrences } from "../domain/recurrence.js";

async function cabinOk(id,locationId){
  if(!id)return;
  const r=await getResourceById(id);
  if(!r||r.resource_type!=="cabin"||r.location_id!==locationId)throw new Error("Ungültige Kabine");
}
export async function addTrainingSeries(input){
  const club=await getClub();
  const {teamId,recurrenceType,weekday,monthOrdinal,startDate,endDate,start,end,locationId,baseName,
    allocationMode="flexible",cabin1Id=null,cabin2Id=null,note=""}=input;
  if(!teamId||!startDate||!start||!end)throw new Error("Pflichtfelder fehlen");
  if(!["weekly","biweekly","monthly"].includes(recurrenceType))throw new Error("Ungültiger Wiederholungsrhythmus");
  if(recurrenceType==="monthly"&&!["1","2","3","4","last"].includes(String(monthOrdinal)))throw new Error("Ungültige Monatsregel");
  if(!["gemmingen","stebbach"].includes(locationId))throw new Error("Ungültiger Ort");
  if(!["Hauptplatz","Trainingsplatz"].includes(baseName))throw new Error("Ungültiger Platz");
  if(!["flexible","half_a","half_b","exclusive"].includes(allocationMode))throw new Error("Ungültige Belegung");
  if(start>=end)throw new Error("Trainingszeit ist ungültig");
  await cabinOk(cabin1Id,locationId);await cabinOk(cabin2Id,locationId);

  const section=allocationMode==="half_a"?"half_a":allocationMode==="half_b"?"half_b":"whole";
  const resource=await findPitchResource(locationId,baseName,section);
  if(!resource)throw new Error("Platzressource nicht gefunden");
  const address=locationId==="gemmingen"?"Beim Sportplatz 3, 75050 Gemmingen":"Jahnweg 1, 75050 Gemmingen-Stebbach";

  const seriesId=await createSeries({clubId:club.id,teamId,recurrenceType,weekday:Number(weekday),monthOrdinal,
    startDate,endDate,start,end,locationId,baseName,allocationMode,cabin1Id,cabin2Id,note});
  const dates=generateOccurrences({recurrenceType,weekday:Number(weekday),monthOrdinal,startDate,endDate});
  for(const date of dates){
    await createTraining({clubId:club.id,teamId,date,start,end,locationId,resourceId:resource.id,allocationMode,
      requestedSection:section,cabin1Id,cabin2Id,address,note,seriesId});
  }
  return {seriesId,created:dates.length};
}
export async function removeTrainingSeries(id){
  const s=await getSeries(id);if(!s)throw new Error("Trainingsserie nicht gefunden");
  await db(`delete from cp5_events where series_id=$1`,[id]);
  await deactivateSeries(id);return true;
}
export {listSeries};
