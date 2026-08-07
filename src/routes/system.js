import { Router } from "express";
import { getSystemStatus } from "../services/system-service.js";

export const systemRouter=Router();
systemRouter.get("/status",async(req,res,next)=>{
  try{res.json(await getSystemStatus())}catch(e){next(e)}
});
