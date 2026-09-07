import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("series mode hides single-date field and uses series API",()=>{
  const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  assert.match(html,/id="singleDateField"/);
  assert.match(html,/singleDateField/);
  assert.match(html,/classList\.toggle\("hidden",trainingMode==="series"\)/);
  assert.match(html,/\/api\/v5\/training-series/);
  assert.match(html,/trainingMode==="series"/);
});

test("visible version is 4.3.7",()=>{
  const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  assert.match(html,/Sprint 4\.3\.7/);
});
