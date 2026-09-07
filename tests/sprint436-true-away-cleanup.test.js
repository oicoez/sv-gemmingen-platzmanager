import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("active sync inspects true away fixtures",()=>{
  const js=fs.readFileSync(new URL("../src/services/fussballde/sync-service.js",import.meta.url),"utf8");
  assert.match(js,/const awayAll=all\.filter\(x=>isClubHomeTeam\(x\.away\)\)/);
  assert.match(js,/awayAll\.map\(row=>\(\{/);
  assert.match(js,/home:row\.away/);
  assert.match(js,/away:row\.home/);
  assert.match(js,/removedTrueAway/);
});

test("cleanup tolerates Gemmingen naming variants",()=>{
  const js=fs.readFileSync(new URL("../src/repositories/event-repository.js",import.meta.url),"utf8");
  assert.match(js,/lower\(trim\(e\.opponent\)\)=lower\(trim\(\$4\)\)/);
  assert.match(js,/lower\(trim\(t\.name\)\)=lower\(trim\(\$3\)\)/);
  assert.match(js,/lower\(t\.name\) like '%gemmingen%'/);
});
