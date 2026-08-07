import { Router } from "express";
import { listImportedEvents } from "../repositories/event-repository.js";

export const eventsRouter=Router();
eventsRouter.get("/",async(req,res)=>res.json({events:await listImportedEvents()}));
