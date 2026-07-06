import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import postgresManager from './database/postgres.manager.js';
import redisManager from './database/redis.manager.js';

import HealthRouter from "./health/health.routes.js";
import AuthRouter from "./auth/auth.routes.js";
import UserRouter from "./user/user.routes.js";


try {
  await postgresManager.connect();
  await redisManager.connect();
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser(process.env.COOKIE_SECRET));

  app.use('/health', HealthRouter);
  app.use('/auth', AuthRouter);
  app.use('/users', UserRouter);

  const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
  });

  // server
} catch (error) {
  console.log(error);
}
