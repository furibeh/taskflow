import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'debe ser una URL postgres://'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_WEB_URL: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Límites de peticiones por IP y minuto (plan.md D5). Se pueden subir (p. ej., en los E2E),
  // pero nunca desactivar: el mínimo es 1.
  RATE_LIMIT_GLOBAL: z.coerce.number().int().min(1).max(100_000).default(300),
  RATE_LIMIT_WRITES: z.coerce.number().int().min(1).max(100_000).default(60),
  RATE_LIMIT_UNAUTHORIZED: z.coerce.number().int().min(1).max(100_000).default(20),
});

export type Env = z.infer<typeof EnvSchema>;

/** Valida el entorno al arrancar. Nunca imprime los valores, solo qué variables fallan. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    console.error(`Configuración inválida:\n  ${fields.join('\n  ')}`);
    process.exit(1);
  }
  return parsed.data;
};
