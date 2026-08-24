import { Router } from "express";
import { listTeams } from "../services/team-service.js";

export const teamsRouter=Router();
teamsRouter.get("/",async(req,res,next)=>{
  try{res.json({items:await listTeams()})}catch(e){next(e)}
});
