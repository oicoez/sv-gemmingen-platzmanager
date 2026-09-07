import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client=fs.readFileSync(new URL("../src/services/fussballde/matchplan-client.js",import.meta.url),"utf8");
const sync=fs.readFileSync(new URL("../src/services/fussballde/sync-service.js",import.meta.url),"utf8");
const parser=fs.readFileSync(new URL("../src/services/fussballde/matchplan-parser.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");

test("loads Gemmingen and Stebbach club matchplans",()=>{
  assert.match(client,/sourceClub:"gemmingen"/);
  assert.match(client,/sourceClub:"stebbach"/);
  assert.match(client,/00ES8GN9B800005MVV0AG08LVUPGND5I/);
});

test("merges identical games by game number",()=>{
  assert.match(sync,/row\.gameNumber\?`game:\$\{row\.gameNumber\}`/);
});

test("prefers Stebbach source for JSG SG teams",()=>{
  assert.match(sync,/return "stebbach"/);
  assert.match(sync,/JSG Gemmingen/);
  assert.match(sync,/SG Stebbach/);
});

test("supports manually added Gemmingen Stebbach team names",()=>{
  assert.match(parser,/Gemmingen\\\/Stebbach/);
});

test("visible version is 4.4.3",()=>assert.match(html,/Sprint 4\.4\.3/));
