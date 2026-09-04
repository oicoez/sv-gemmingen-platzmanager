import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("active sync passes full external fixture identity to cleanup",()=>{
  const js=fs.readFileSync(new URL("../src/services/fussballde/sync-service.js",import.meta.url),"utf8");
  assert.match(js,/deleteConfirmedExternalEvents\(/);
  assert.match(js,/externalId:row\.externalId/);
  assert.match(js,/date:row\.date/);
  assert.match(js,/home:row\.home/);
  assert.match(js,/away:row\.away/);
});

test("active repository deletes stale external events by id or fixture identity",()=>{
  const js=fs.readFileSync(new URL("../src/repositories/event-repository.js",import.meta.url),"utf8");
  assert.match(js,/delete from cp5_events e/);
  assert.match(js,/using cp5_teams t/);
  assert.match(js,/e\.external_id=\$1/);
  assert.match(js,/e\.event_date=\$2::date/);
  assert.match(js,/lower\(trim\(e\.opponent\)\)=lower\(trim\(\$4\)\)/);
  assert.match(js,/lower\(trim\(t\.name\)\)=lower\(trim\(\$3\)\)/);
});
