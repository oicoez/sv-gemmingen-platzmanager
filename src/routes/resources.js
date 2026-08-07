import { Router } from "express";
import { listResources } from "../services/resource-service.js";

export const resourcesRouter=Router();
resourcesRouter.get("/",async(req,res,next)=>{
  try{res.json({items:await listResources()})}catch(e){next(e)}
});
