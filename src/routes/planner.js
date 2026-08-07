import { Router } from "express";
import { buildWeekPlan,buildMonthPlan } from "../services/planner-service.js";
export const plannerRouter=Router();
plannerRouter.get("/week",async(req,res,next)=>{try{res.json(await buildWeekPlan(req.query.start))}catch(e){next(e)}});

plannerRouter.get("/month",async(req,res,next)=>{
  try{res.json(await buildMonthPlan(req.query.month))}catch(e){next(e)}
});
