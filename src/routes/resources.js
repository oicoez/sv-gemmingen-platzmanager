import { Router } from "express";
import { requireEditPin } from "../middleware/auth.js";
import { listResources,resourceOverview,addTrainingPlace,updatePlaceColor,removeTrainingPlace } from "../services/resource-service.js";

export const resourcesRouter=Router();
resourcesRouter.get("/",async(req,res,next)=>{try{res.json({items:await listResources()})}catch(e){next(e)}});
resourcesRouter.get("/overview",async(req,res,next)=>{try{res.json(await resourceOverview())}catch(e){next(e)}});
resourcesRouter.post("/places",requireEditPin,async(req,res,next)=>{
  try{res.status(201).json({ok:true,id:await addTrainingPlace(req.body||{})})}catch(e){next(e)}
});
resourcesRouter.patch("/places/:locationId/color",requireEditPin,async(req,res,next)=>{
  try{await updatePlaceColor(req.params.locationId,req.body?.color);res.json({ok:true})}catch(e){next(e)}
});
resourcesRouter.delete("/places/:locationId",requireEditPin,async(req,res,next)=>{
  try{await removeTrainingPlace(req.params.locationId);res.json({ok:true})}catch(e){next(e)}
});
