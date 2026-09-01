import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("series mode uses series endpoint and hides single-date field",()=>{
  const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  assert.match(html,/id="singleDateField"/);
  assert.match(html,/singleDateField"\)\.classList\.toggle/);
  assert.match(html,/\/api\/v5\/training-series/);
  assert.match(html,/trainingMode==="series"/);
});

test("scheduled FUSSBALL.DE games require a local venue",()=>{
  const js=fs.readFileSync(new URL("../services/fussballde-importer.js",import.meta.url),"utf8");
  assert.match(js,/!\["Gemmingen","Stebbach"\]\.includes\(detail\.location\)/);
  assert.doesNotMatch(js,/Beim Sportplatz\|SV Gemmingen/);
});
