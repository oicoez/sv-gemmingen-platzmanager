import { config } from "../config/index.js";

export function requireEditPin(req,res,next){
  if(req.headers["x-edit-pin"]!==config.editPin){
    return res.status(401).json({error:"Bearbeitungs-PIN falsch"});
  }
  next();
}
