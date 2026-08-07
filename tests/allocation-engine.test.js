import test from "node:test";
import assert from "node:assert/strict";
import { buildSegments,allocateInterval } from "../src/domain/allocation-engine.js";
const tr=(id,team,start,end)=>({id,team,event_type:"training",start_time:start,end_time:end,allocation_mode:"flexible",requested_section:"whole"});
test("Praxisbeispiel wird in Gesamt / A-B / Gesamt zerlegt",()=>{
 const seg=buildSegments([tr("b","B-Junioren","18:00","19:30"),tr("h","Herren","19:00","20:30")]);
 assert.equal(seg.length,3);
 assert.deepEqual(seg.map(s=>[s.start,s.end,s.items.map(i=>i.section)]),[
  ["18:00","19:00",["whole"]],
  ["19:00","19:30",["half_a","half_b"]],
  ["19:30","20:30",["whole"]]
 ]);
 assert.equal(seg.some(s=>s.conflict),false);
});
test("drei gleichzeitige Trainings ergeben Konflikt",()=>{
 const r=allocateInterval([tr("1","A","18:00","19:30"),tr("2","B","18:00","19:30"),tr("3","C","18:00","19:30")]);
 assert.equal(r.conflict,true);
});
