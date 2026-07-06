import { Router } from "express";
import UserController from "./user.controller.js"
import AuthMiddleware from '../auth/auth.middleware.js';

const userRouter = Router();


userRouter.get("/me", AuthMiddleware.requireAuth, UserController.getUser);

export default userRouter;
