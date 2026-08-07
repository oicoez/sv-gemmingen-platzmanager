import { Router } from "express";
import { config } from "../config/index.js";
import { requireEditPin } from "../middleware/auth.js";

export const authRouter=Router();
authRouter.post("/login",(req,res)=>{
  res.json({ok:req.body?.pin===config.editPin});
});
authRouter.post("/check",requireEditPin,(req,res)=>res.json({ok:true}));
