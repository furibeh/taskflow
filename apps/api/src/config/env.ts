import { isIP } from 'node:net';
import { z } from 'zod';

/** IP o rango CIDR válido (IPv4 o IPv6). */
const isAddressOrCidr = (value: string): boolean => {
  const [address = '', prefix, ...rest] = value.split('/');
  const version = isIP(address);
  if (version === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (version === 4 ? 32 : 128);
};

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
  // Proxies cuya cabecera X-Forwarded-For se acepta para conocer la IP real del cliente (plan
  // D11). Solo IP o rangos CIDR explícitos: nunca "true", "*" ni un número de saltos, para que un
  // cliente conectado directamente no pueda suplantar su IP. Vacío = no se confía en ninguno.
  TRUST_PROXY: z
    .string()
    .default('')
    .transform((value) => (value.trim() === '' ? [] : value.split(',').map((v) => v.trim())))
    .refine((list) => list.every(isAddressOrCidr), 'debe ser una lista de IP o rangos CIDR'),
  // Creación de tableros desde la web (plan D12): interruptor y creaciones nuevas por IP y hora.
  BOARD_CREATION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  BOARD_CREATION_PER_HOUR: z.coerce.number().int().min(1).max(100_000).default(10),
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
