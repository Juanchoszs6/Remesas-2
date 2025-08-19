import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .email('Por favor ingresa un email válido')
    .regex(/^[^\s@]+@gmail\.com$/, 'Solo se permiten emails de Gmail'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z
    .string()
    .min(6, 'La confirmación de contraseña debe tener al menos 6 caracteres')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Por favor ingresa un email válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
