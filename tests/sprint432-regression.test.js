import test from "node:test";
import assert from "node:assert/strict";
import { generateOccurrences } from "../src/domain/recurrence.js";

test("weekly series creates every Monday through end date",()=>{
  const dates=generateOccurrences({
    recurrenceType:"weekly",
    weekday:1,
    startDate:"2026-09-07",
    endDate:"2026-10-05"
  });
  assert.deepEqual(dates,[
    "2026-09-07","2026-09-14","2026-09-21","2026-09-28","2026-10-05"
  ]);
});

test("biweekly series creates alternating Mondays",()=>{
  const dates=generateOccurrences({
    recurrenceType:"biweekly",
    weekday:1,
    startDate:"2026-09-07",
    endDate:"2026-10-31"
  });
  assert.deepEqual(dates,[
    "2026-09-07","2026-09-21","2026-10-05","2026-10-19"
  ]);
});
