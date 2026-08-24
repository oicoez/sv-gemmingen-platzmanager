import { Router } from "express";
import { listResources,resourceOverview } from "../services/resource-service.js";

export const resourcesRouter=Router();
resourcesRouter.get("/",async(req,res,next)=>{
  try{res.json({items:await listResources()})}catch(e){next(e)}
});
resourcesRouter.get("/overview",async(req,res,next)=>{
  try{res.json(await resourceOverview())}catch(e){next(e)}
});
