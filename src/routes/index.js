import { Router } from "express";
import { systemRouter } from "./system.js";
import { teamsRouter } from "./teams.js";
import { resourcesRouter } from "./resources.js";
import { authRouter } from "./auth.js";
import { syncRouter } from "./sync.js";
import { eventsRouter } from "./events.js";
import { trainingsRouter } from "./trainings.js";
import { plannerRouter } from "./planner.js";
import { dashboardRouter } from "./dashboard.js";

export const apiRouter=Router();
apiRouter.use("/system",systemRouter);
apiRouter.use("/teams",teamsRouter);
apiRouter.use("/resources",resourcesRouter);
apiRouter.use("/auth",authRouter);

apiRouter.use("/sync",syncRouter);
apiRouter.use("/events",eventsRouter);

apiRouter.use("/trainings",trainingsRouter);
apiRouter.use("/planner",plannerRouter);

apiRouter.use("/dashboard",dashboardRouter);
