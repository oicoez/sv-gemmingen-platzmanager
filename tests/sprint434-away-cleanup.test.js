import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const js=fs.readFileSync(new URL("../services/fussballde-importer.js",import.meta.url),"utf8");
test("stale away fixture cleanup has external-id fallback",()=>{
 assert.match(js,/external_id=\$1/);
 assert.match(js,/event_date=\$2::date/);
 assert.match(js,/lower\(trim\(opponent\)\)=lower\(trim\(\$3\)\)/);
 assert.match(js,/removePreviouslyImportedGame\(detail/);
});
