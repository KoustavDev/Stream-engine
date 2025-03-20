import { Router } from "express";
import { checkHealth } from "../controllers/healthCheck.controller.js";

const healthCheckRoute = Router();

healthCheckRoute.get("/", checkHealth);

export default healthCheckRoute;