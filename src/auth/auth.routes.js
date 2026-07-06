import { Router } from "express";
import AuthController from "./auth.controller.js";
import AuthMiddleware from './auth.middleware.js';

const authRouter = Router();


authRouter.post("/register", AuthController.register);
authRouter.post("/login", AuthController.login);
authRouter.post("/logout", AuthMiddleware.requireAuth, AuthController.logout);
authRouter.post("/refresh", AuthController.refresh);

export default authRouter;
