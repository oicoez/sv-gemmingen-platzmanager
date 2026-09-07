import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const teams=fs.readFileSync(new URL("../src/routes/teams.js",import.meta.url),"utf8");
const teamService=fs.readFileSync(new URL("../src/services/team-service.js",import.meta.url),"utf8");
const sync=fs.readFileSync(new URL("../src/services/fussballde/sync-service.js",import.meta.url),"utf8");
const schema=fs.readFileSync(new URL("../src/database/schema.js",import.meta.url),"utf8");

test("date fields are separated by mode",()=>{
 assert.equal((html.match(/id="trDate"/g)||[]).length,1);
 assert.equal((html.match(/id="seriesStartDate"/g)||[]).length,1);
 assert.equal((html.match(/id="seriesEndDate"/g)||[]).length,1);
 assert.match(html,/\.hidden\{display:none!important\}/);
});
test("cabins are named home and guest with yes no",()=>{
 assert.match(html,/label>Heimkabine/);assert.match(html,/label>Gastkabine/);
 assert.match(html,/option value="">Nein<\/option><option value="yes">Ja<\/option>/);
 assert.doesNotMatch(html,/Kabine 1/);assert.doesNotMatch(html,/Kabine 2/);
});
test("team management API exists",()=>{
 assert.match(teams,/teamsRouter\.post\("\/"/);assert.match(teams,/teamsRouter\.delete\("\/:id"/);
 assert.match(teamService,/export async function addTeam/);assert.match(teamService,/export async function removeTeam/);
});
test("removed defaults stay inactive",()=>assert.match(schema,/on conflict\(club_id,name\) do nothing/));
test("sync uses active exact team matching",()=>{
 assert.match(sync,/findActiveTeamForFixture/);assert.match(teamService,/lower\(name\)=lower\(\$2\)/);
 assert.match(sync,/candidateHome/);assert.match(sync,/candidateAway/);
});
test("away cleanup still exists",()=>assert.match(sync,/deleteConfirmedExternalEvents/));
test("visible version is 4.4.0",()=>assert.match(html,/Sprint 4\.4\.0/));
