import bcrypt from 'bcrypt';
import AuthRepository from './auth.repository.js';
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export default class AuthService {

  static async register(email, password) {

    const userFound = await AuthRepository.findUserByEmail(email);

    if (userFound) {
      throw new Error('Email already exists');
    }

    const passwordHash = await bcrypt.hash(prehash(password), 10); // ✅ nunca > 72 bytes
    const newUser = await AuthRepository.createUser(email, passwordHash);
    return newUser;

  }

  static async login(email, password) {
    const user = await AuthRepository.findUserByEmail(email);
    if (user.length === 0) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(prehash(password), user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    return user;
  }

  static async createTokenPair(user, req) {
    const jti = crypto.randomUUID();

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, jti }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await AuthRepository.createRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: req.headers["user-agent"] ?? null,
      ipAddress: req.ip ?? null,
    });

    return { accessToken, refreshToken };
  }
}

// El problema: bcrypt trunca a 72 bytes
// bcrypt tiene un límite interno de 72 bytes. Todo lo que venga después se ignora silenciosamente.
// Problema 1 — Colisión de contraseñas: dos passwords que compartan los primeros 72 bytes producen el mismo hash
// Problema 2 — DoS con passwords enormes (el más conocido): algunas implementaciones de bcrypt, solventado con el límite de 128 caracteres en el schema.
function prehash(password) {
  return crypto.createHash("sha256").update(password).digest("hex"); // 64 bytes, siempre
}
