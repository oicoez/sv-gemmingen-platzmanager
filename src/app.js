import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,"..");

export function createApp(){
  const app=express();
  app.disable("x-powered-by");
  app.use(express.json({limit:"3mb"}));

  app.use((req,res,next)=>{
    if(req.path==="/"||req.path.endsWith(".html")||req.path.startsWith("/api/")){
      res.set("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma","no-cache");
      res.set("Expires","0");
    }
    next();
  });

  app.get("/health",(req,res)=>res.json({ok:true,app:"ClubPlanner 5.0"}));
  app.use("/api/v5",apiRouter);

  // Sprint 1 keeps the current UI available while the new backend is built.
  app.use(express.static(path.join(root,"public"),{etag:false,lastModified:false,maxAge:0}));

  app.use((err,req,res,next)=>{
    logger.error("Unhandled API error",{path:req.path,message:err.message});
    res.status(500).json({error:"Interner Serverfehler",detail:err.message});
  });
  return app;
}
