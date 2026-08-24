import { Router } from "express";
import { buildWeeklyDashboard } from "../services/dashboard-service.js";
export const dashboardRouter=Router();
dashboardRouter.get("/week",async(req,res,next)=>{
  try{res.json(await buildWeeklyDashboard())}catch(e){next(e)}
});
