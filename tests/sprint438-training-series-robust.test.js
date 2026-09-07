import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");

test("series mode UI sync exists",()=>{
  assert.match(html,/function syncTrainingModeUI\(\)/);
  assert.match(html,/singleDateField"\)\.style\.display=trainingMode==="series"\?"none":""/);
  assert.match(html,/addEventListener\("change",syncTrainingModeUI\)/);
});

test("save handler reads selected radio directly",()=>{
  assert.match(html,/const selectedMode=document\.querySelector\('input\[name="trainingMode"\]:checked'\)\?\.value\|\|"single"/);
  assert.match(html,/if\(selectedMode==="series"&&!editingTrainingId\)/);
  assert.match(html,/\/api\/v5\/training-series/);
});

test("mode sync runs at startup and on training tab",()=>{
  assert.match(html,/bootstrapToday\(\);syncTrainingModeUI\(\)/);
  assert.match(html,/if\(b\.dataset\.view==="training"\)\{syncTrainingModeUI\(\)/);
});

test("visible version is 4.3.8",()=>{
  assert.match(html,/Sprint 4\.3\.8/);
});
