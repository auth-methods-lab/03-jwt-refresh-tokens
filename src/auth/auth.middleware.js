import jwt from "jsonwebtoken";
import redisManager from "../database/redis.manager.js";

export default class AuthMiddleware {

  static async requireAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
      }

      const token = authHeader.split(" ")[1];

      // Verificar firma y expiración
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch {
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
      }

      // Verificar blacklist Redis
      const isBlacklisted = await redisManager.client.get(`blacklist:${decoded.jti}`);
      if (isBlacklisted) {
        return res.status(401).json({ message: "Unauthorized: Token has been revoked" });
      }

      req.token = decoded; // { sub, email, jti, iat, exp }
      next();

    } catch (error) {
      console.error("Error in requireAuth middleware:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

}
