import test from "node:test";
import assert from "node:assert/strict";
import { buildSegments } from "../src/domain/allocation-engine.js";
const tr=(id,team,start,end)=>({id,team,event_type:"training",start_time:start,end_time:end,allocation_mode:"flexible",requested_section:"whole"});
test("zwei flexible Trainings zeigen Hälfte A und B",()=>{
  const seg=buildSegments([tr("a","A","18:00","19:30"),tr("b","B","18:00","19:30")]);
  assert.deepEqual(seg[0].items.map(x=>x.section),["half_a","half_b"]);
});
test("zeitversetzte Trainings zeigen Gesamt-A/B-Gesamt",()=>{
  const seg=buildSegments([tr("a","B","18:00","19:30"),tr("b","H","19:00","20:30")]);
  assert.deepEqual(seg.map(s=>[s.start,s.end,s.items.map(i=>i.section)]),[
    ["18:00","19:00",["whole"]],
    ["19:00","19:30",["half_a","half_b"]],
    ["19:30","20:30",["whole"]]
  ]);
});
