import AuthSchema from "./auth.schema.js";
import AuthService from './auth.service.js';

export default class AuthController {

  static async register(req, res) {
    try {
      const { email, password } = req.body;
      const validationResult = AuthSchema.validateRegister({ email, body });

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

  }

  static async logout(req, res) {

  }

  static async refresh(req, res) {

  }

}
