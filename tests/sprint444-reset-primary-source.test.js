import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sync=fs.readFileSync(new URL("../src/services/fussballde/sync-service.js",import.meta.url),"utf8");
const repo=fs.readFileSync(new URL("../src/repositories/event-repository.js",import.meta.url),"utf8");
const routes=fs.readFileSync(new URL("../src/routes/events.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");

test("Gemmingen is primary source for duplicate official games",()=>{
 assert.match(sync,/return "gemmingen"/);
 assert.doesNotMatch(sync,/JSG Gemmingen\\\/Stebbach.*return "stebbach"/);
});

test("reset deletes only imported home matches",()=>{
 assert.match(repo,/deleteAllImportedGames/);
 assert.match(repo,/source='fussballde' and event_type='home_match'/);
});

test("protected reset endpoint exists",()=>{
 assert.match(routes,/delete\("\/all",requireEditPin/);
});

test("UI has reset button and confirmations",()=>{
 assert.match(html,/id="resetGames"/);
 assert.match(html,/Alle Spiele löschen/);
 assert.match(html,/Letzte Bestätigung/);
});

test("visible version is 4.4.4",()=>assert.match(html,/Sprint 4\.4\.4/));
