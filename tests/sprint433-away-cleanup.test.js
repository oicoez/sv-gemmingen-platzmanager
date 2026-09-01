import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("away/external fixtures remove stale imported bookings",()=>{
  const js=fs.readFileSync(new URL("../services/fussballde-importer.js",import.meta.url),"utf8");
  assert.match(js,/removePreviouslyImportedGame/);
  assert.match(js,/delete from clubplanner_events where source='fussball.de' and external_id=\$1/);
  assert.match(js,/externer Spielort/);
});
