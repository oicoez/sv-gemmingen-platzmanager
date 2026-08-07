import { Router } from "express";
import { listImportedEvents } from "../repositories/event-repository.js";

export const eventsRouter=Router();
eventsRouter.get("/",async(req,res)=>{
  const includePast=req.query.includePast==="1"||req.query.includePast==="true";
  res.json({events:await listImportedEvents({includePast})});
});
