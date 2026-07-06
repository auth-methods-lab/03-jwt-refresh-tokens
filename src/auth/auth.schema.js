import z from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128, 'Máximo 128 caracteres')
    .refine(val => /[a-z]/.test(val), 'Debe contener al menos una minúscula')
    .refine(val => /[A-Z]/.test(val), 'Debe contener al menos una mayúscula')
    .refine(val => /\d/.test(val), 'Debe contener al menos un número')
    .refine(val => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val), 'Debe contener al menos un carácter especial')
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'La contraseña es requerida').max(128)
  // ✅ Solo verificamos que existe y no supera el límite de bcrypt
})

export default class AuthSchema {
  static validateRegister(input) {
    return registerSchema.safeParse(input)
  }

  static validateLogin(input) {
    return loginSchema.safeParse(input)
  }
}
