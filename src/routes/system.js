import { Router } from "express";
import { getSystemStatus } from "../services/system-service.js";
import { berlinDateString,mondayOf,currentMonthBerlin } from "../utils/date.js";

export const systemRouter=Router();
systemRouter.get("/status",async(req,res,next)=>{
  try{res.json(await getSystemStatus())}catch(e){next(e)}
});

systemRouter.get("/today",(req,res)=>{
  const today=berlinDateString();
  res.json({today,weekStart:mondayOf(today),month:currentMonthBerlin(),timeZone:"Europe/Berlin"});
});
