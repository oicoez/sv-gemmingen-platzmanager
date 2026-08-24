import { Router } from "express";
import { requireEditPin } from "../middleware/auth.js";
import { addTrainingSeries,listSeries,removeTrainingSeries } from "../services/training-series-service.js";
export const trainingSeriesRouter=Router();
trainingSeriesRouter.get("/",async(req,res,next)=>{try{res.json({items:await listSeries()})}catch(e){next(e)}});
trainingSeriesRouter.post("/",requireEditPin,async(req,res,next)=>{try{res.status(201).json({ok:true,...await addTrainingSeries(req.body||{})})}catch(e){next(e)}});
trainingSeriesRouter.delete("/:id",requireEditPin,async(req,res,next)=>{try{await removeTrainingSeries(req.params.id);res.json({ok:true})}catch(e){next(e)}});
