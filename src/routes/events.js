import { Router } from "express";
import { requireEditPin } from "../middleware/auth.js";
import { listImportedEvents } from "../repositories/event-repository.js";
import { getGame,editGame,resetImportedGames } from "../services/event-service.js";

export const eventsRouter=Router();

eventsRouter.get("/",async(req,res,next)=>{
  try{
    const includePast=req.query.includePast==="1"||req.query.includePast==="true";
    res.json({events:await listImportedEvents({includePast})});
  }catch(e){next(e)}
});

eventsRouter.delete("/all",requireEditPin,async(req,res,next)=>{
  try{
    const deleted=await resetImportedGames();
    res.json({ok:true,deleted});
  }catch(e){next(e)}
});

eventsRouter.get("/:id",async(req,res,next)=>{
  try{
    const item=await getGame(req.params.id);
    if(!item)return res.status(404).json({error:"Spiel nicht gefunden"});
    res.json({item});
  }catch(e){next(e)}
});

eventsRouter.put("/:id",requireEditPin,async(req,res,next)=>{
  try{res.json({ok:true,id:await editGame(req.params.id,req.body||{})})}catch(e){next(e)}
});
