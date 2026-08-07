import { Router } from "express";
import { requireEditPin } from "../middleware/auth.js";
import { addTraining,deleteTraining,listTrainings } from "../services/training-service.js";
export const trainingsRouter=Router();
trainingsRouter.get("/",async(req,res,next)=>{try{
  const from=req.query.from||new Date().toISOString().slice(0,10),to=req.query.to||from;
  res.json({items:await listTrainings({from,to})});
}catch(e){next(e)}});
trainingsRouter.post("/",requireEditPin,async(req,res,next)=>{try{
  res.status(201).json({ok:true,id:await addTraining(req.body||{})});
}catch(e){next(e)}});
trainingsRouter.delete("/:id",requireEditPin,async(req,res,next)=>{try{
  const ok=await deleteTraining(req.params.id);if(!ok)return res.status(404).json({error:"Training nicht gefunden"});res.json({ok:true});
}catch(e){next(e)}});
