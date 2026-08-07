import { Router } from "express";
import { config } from "../config/index.js";

export const authRouter=Router();
authRouter.post("/login",(req,res)=>{
  res.json({ok:req.body?.pin===config.editPin});
});
