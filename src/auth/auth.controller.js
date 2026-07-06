import AuthSchema from "./auth.schema.js";
import AuthService from './auth.service.js';

export default class AuthController {

  static async register(req, res) {
    try {
      const { email, password } = req.body;
      const validationResult = AuthSchema.validateRegister({ email, password });

      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid input data", errors: validationResult.error.flatten() });
      }

      const newUser = await AuthService.register(email, password);
      const { id } = newUser;
      res.status(201).json({ message: "User registered successfully", user: { id, email } });
    } catch (error) {
      if (error.message === "Email already exists") {
        return res.status(409).json({ message: error.message });
      }
      console.error("Error during registration:", error);
      return res.status(500).json({ message: "Internal server error" });
    }


  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const validationResult = AuthSchema.validateLogin({ email, password });

      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid input data", errors: validationResult.error.flatten() });
      }

      const user = await AuthService.login(email, password);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const { accessToken, refreshToken } = await AuthService.createTokenPair(user, req);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 días
      });

      return res.status(200).json({
        message: "Login successful", user: { id: user.id, email: user.email }, accessToken
      });


    } catch (error) {
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  static async logout(req, res) {

  }

  static async refresh(req, res) {

  }

}
