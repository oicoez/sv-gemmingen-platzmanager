import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");

test("week trainings are clickable",()=>{
  assert.match(html,/data-training-id/);
  assert.match(html,/title="Training bearbeiten"/);
});

test("calendar click opens training edit",()=>{
  assert.match(html,/e\.target\.closest\("\[data-training-id\]"\)/);
  assert.match(html,/await editTrainingForm\(id\)/);
});

test("editing occurrence forces single mode",()=>{
  assert.match(html,/input\[name="trainingMode"\]\[value="single"\]/);
  assert.match(html,/singleRadio\.checked=true/);
  assert.match(html,/syncTrainingModeUI\(\)/);
});

test("series occurrence edit clearly says only one unit",()=>{
  assert.match(html,/Nur diese Einheit speichern/);
  assert.match(html,/nur diesen einzelnen Trainingstermin/);
  assert.match(html,/Trainingsserie bleibt unverändert/);
});

test("visible version is 4.4.1",()=>{
  assert.match(html,/Sprint 4\.4\.1/);
});
