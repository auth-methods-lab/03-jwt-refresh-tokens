import { Router } from "express";
import HealthController from "./health.controller.js";

const HealthRouter = Router();

HealthRouter.get("/", HealthController.getHealthCheck);

export default HealthRouter;
