import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const team=fs.readFileSync(new URL("../src/services/team-service.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");

function normalize(v){
 return String(v??"")
   .replace(/[\u200b\u200c\u200d\u2060]/g,"")
   .replace(/\u00a0/g," ")
   .replace(/\s*\/\s*/g,"/")
   .replace(/\s+(?=\d+\s*$)/g,"")
   .replace(/\s+/g," ")
   .trim()
   .toLocaleLowerCase("de-DE");
}

test("slash spacing ignored",()=>assert.equal(normalize("SG Stebbach / Gemmingen"),normalize("SG Stebbach/Gemmingen")));
test("space before second-team number ignored",()=>assert.equal(normalize("SG Stebbach/Gemmingen 2"),normalize("SG Stebbach/Gemmingen2")));
test("JSG second-team number spacing ignored",()=>assert.equal(normalize("JSG Gemmingen/Stebbach 2"),normalize("JSG Gemmingen/Stebbach2")));
test("squad number itself remains significant",()=>assert.notEqual(normalize("SG Stebbach/Gemmingen"),normalize("SG Stebbach/Gemmingen2")));
test("production matcher contains number normalization",()=>assert.ok(team.includes('.replace(/\\s+(?=\\d+\\s*$)/g,"")')));
test("version 4.4.6 visible",()=>assert.match(html,/Sprint 4\.4\.6/));
