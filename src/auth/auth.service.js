import bcrypt from 'bcrypt';
import AuthRepository from './auth.repository.js';
import crypto from "node:crypto";


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
}

// El problema: bcrypt trunca a 72 bytes
// bcrypt tiene un límite interno de 72 bytes. Todo lo que venga después se ignora silenciosamente.
// Problema 1 — Colisión de contraseñas: dos passwords que compartan los primeros 72 bytes producen el mismo hash
// Problema 2 — DoS con passwords enormes (el más conocido): algunas implementaciones de bcrypt, solventado con el límite de 128 caracteres en el schema.
function prehash(password) {
  return crypto.createHash("sha256").update(password).digest("hex"); // 64 bytes, siempre
}
