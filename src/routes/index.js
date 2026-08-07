import { Router } from "express";
import { systemRouter } from "./system.js";
import { teamsRouter } from "./teams.js";
import { resourcesRouter } from "./resources.js";
import { authRouter } from "./auth.js";

export const apiRouter=Router();
apiRouter.use("/system",systemRouter);
apiRouter.use("/teams",teamsRouter);
apiRouter.use("/resources",resourcesRouter);
apiRouter.use("/auth",authRouter);
