import { Router } from "express";
import { requireEditPin } from "../middleware/auth.js";
import { listTeams,addTeam,removeTeam } from "../services/team-service.js";

export const teamsRouter=Router();

teamsRouter.get("/",async(req,res,next)=>{
  try{res.json({items:await listTeams()})}catch(e){next(e)}
});

teamsRouter.post("/",requireEditPin,async(req,res,next)=>{
  try{res.status(201).json({ok:true,id:await addTeam(req.body||{})})}catch(e){next(e)}
});

teamsRouter.delete("/:id",requireEditPin,async(req,res,next)=>{
  try{
    const ok=await removeTeam(req.params.id);
    if(!ok)return res.status(404).json({error:"Mannschaft nicht gefunden"});
    res.json({ok:true});
  }catch(e){next(e)}
});
