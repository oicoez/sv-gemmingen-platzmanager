import { Router } from "express";
import { requireEditPin } from "../middleware/auth.js";
import { getSyncState,startFussballSync } from "../services/fussballde/sync-service.js";

export const syncRouter=Router();
syncRouter.get("/status",(req,res)=>res.json(getSyncState()));
syncRouter.post("/fussballde",requireEditPin,async(req,res)=>{
  const started=await startFussballSync();
  res.status(started?202:409).json(started?{ok:true}:{error:"Synchronisierung läuft bereits"});
});
