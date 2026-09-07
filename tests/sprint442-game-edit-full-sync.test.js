import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const repo=fs.readFileSync(new URL("../src/repositories/event-repository.js",import.meta.url),"utf8");
const routes=fs.readFileSync(new URL("../src/routes/events.js",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../src/services/fussballde/matchplan-client.js",import.meta.url),"utf8");

test("games are clickable and editable",()=>{
 assert.match(html,/data-game-id/);
 assert.match(html,/Spiel bearbeiten/);
 assert.match(html,/editGameForm\(id\)/);
 assert.match(routes,/eventsRouter\.put\("\/:id"/);
});

test("manual game edit invalidates official hash",()=>{
 assert.match(repo,/source_hash=''/);
});

test("sync matches moved fixtures by external id or game number identity",()=>{
 assert.match(repo,/findImportedFixture/);
 assert.match(repo,/e\.game_number=\$3/);
 assert.match(repo,/lower\(trim\(e\.opponent\)\)=lower\(trim\(\$2\)\)/);
});

test("official update can replace external id",()=>{
 assert.match(repo,/external_id=\$20/);
});

test("fussballde fetch bypasses cache",()=>{
 assert.match(client,/cache:"no-store"/);
 assert.match(client,/cache-control/);
});

test("visible version is 4.4.2",()=>assert.match(html,/Sprint 4\.4\.2/));
