import test from "node:test";
import assert from "node:assert/strict";
import { mondayOf } from "../src/utils/date.js";

test("7. August 2026 liegt in Woche 3.8.-9.8.",()=>{
  assert.equal(mondayOf("2026-08-07"),"2026-08-03");
});
test("23. August 2026 liegt in Woche 17.8.-23.8.",()=>{
  assert.equal(mondayOf("2026-08-23"),"2026-08-17");
});
