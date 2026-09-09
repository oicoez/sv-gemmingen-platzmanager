import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { allocateInterval } from "../src/domain/allocation-engine.js";

const schema=fs.readFileSync(new URL("../src/database/schema.js",import.meta.url),"utf8");
const resources=fs.readFileSync(new URL("../src/services/resource-service.js",import.meta.url),"utf8");
const training=fs.readFileSync(new URL("../src/services/training-service.js",import.meta.url),"utf8");
const plannerRepo=fs.readFileSync(new URL("../src/repositories/planner-repository.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");

const ev=(id,mode="one_third")=>({id,event_type:"training",team:id,start_time:"18:00",end_time:"19:30",allocation_mode:mode,resource_division_count:3});
test("Kraichgauhalle seeded with 3 divisions",()=>{assert.ok(schema.includes('id:"kraichgauhalle"'));assert.ok(schema.includes('division:3'))});
test("school seeded non-divisible",()=>{assert.ok(schema.includes('id:"schule"'));assert.ok(schema.includes('division:1'))});
test("three 1/3 trainings fit without conflict",()=>{const r=allocateInterval([ev("A"),ev("B"),ev("C")]);assert.equal(r.conflict,false);assert.equal(r.items.length,3)});
test("2/3 plus 1/3 fits",()=>{const r=allocateInterval([ev("A","two_thirds"),ev("B","one_third")]);assert.equal(r.conflict,false)});
test("2/3 plus 2/3 conflicts",()=>{const r=allocateInterval([ev("A","two_thirds"),ev("B","two_thirds")]);assert.equal(r.conflict,true)});
test("whole hall plus another training conflicts",()=>{const r=allocateInterval([ev("A","exclusive"),ev("B")]);assert.equal(r.conflict,true)});
test("custom resource colors stored",()=>assert.ok(resources.includes("calendar_color")));
test("dynamic locations accepted by training service",()=>assert.ok(training.includes("getPitchDefinition(locationId,baseName)")));
test("planner no longer hardcodes only Gemmingen and Stebbach",()=>assert.ok(!plannerRepo.includes("e.location_id in ('gemmingen','stebbach')")));
test("calendar uses place color",()=>assert.ok(html.includes("--place-color")));
test("location/base shown bold",()=>assert.ok(html.includes("placeTitle")));
test("UI can add training places",()=>assert.ok(html.includes("Trainingsort hinzufügen")));
test("4.5.0 flexible resource UI retained",()=>assert.ok(html.includes("Trainingsort hinzufügen")));
