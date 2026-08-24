import test from "node:test";
import assert from "node:assert/strict";
import { findCabinConflicts } from "../src/services/cabin-conflict-service.js";

const e=(id,type,start,end,cabin)=>({
  id,event_type:type,event_date:"2026-09-01",start_time:start,end_time:end,
  kickoff_time:start,location_id:"gemmingen",location:"Gemmingen",
  home_cabin_id:cabin,guest_cabin_id:null,cabin1_base:"Heimkabine",
  team:id,opponent:""
});

test("gleiche Kabine zur gleichen Zeit erzeugt Konflikt",()=>{
  const r=findCabinConflicts([
    e("A","training","18:00","19:30","cab-1"),
    e("B","training","19:00","20:30","cab-1")
  ]);
  assert.equal(r.length,1);
  assert.equal(r[0].cabinLabel,"Kabine 1");
  assert.equal(r[0].start,"19:00");
  assert.equal(r[0].end,"19:30");
});

test("verschiedene Kabinen erzeugen keinen Konflikt",()=>{
  const a=e("A","training","18:00","19:30","cab-1");
  const b=e("B","training","18:30","20:00","cab-2");
  const r=findCabinConflicts([a,b]);
  assert.equal(r.length,0);
});
