/** Límites entre paquetes (plan.md → Arquitectura, Principios I y II de la constitución). */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      comment: 'El dominio no depende de ningún paquete ni de módulos de E/S.',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: {
        pathNot: '^packages/domain/src',
      },
    },
    {
      name: 'contracts-only-domain-and-zod',
      severity: 'error',
      from: { path: '^packages/contracts/src' },
      to: {
        pathNot: ['^packages/contracts/src', '^packages/domain/src', 'node_modules/zod/'],
      },
    },
    {
      name: 'web-no-backend',
      comment: 'La web solo conoce los contratos; nunca la API ni la infraestructura.',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: {
        path: ['^apps/api', '^packages/domain/src', 'node_modules/(pg|kysely|fastify)/'],
      },
    },
    {
      name: 'api-no-web',
      severity: 'error',
      from: { path: '^apps/api/src' },
      to: { path: '^apps/web' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(tests|e2e)/' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'] },
    combinedDependencies: true,
  },
};
