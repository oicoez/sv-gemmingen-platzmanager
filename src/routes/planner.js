import { Router } from "express";
import { buildWeekPlan } from "../services/planner-service.js";
export const plannerRouter=Router();
plannerRouter.get("/week",async(req,res,next)=>{try{res.json(await buildWeekPlan(req.query.start))}catch(e){next(e)}});
