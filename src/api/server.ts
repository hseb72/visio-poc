import Fastify from 'fastify';
import cors from '@fastify/cors';
import { parseDsl } from '../parser/parser.js';
import { applyLayout } from '../layout/elk-layout.js';
import { generateVsdx } from '../generator/vsdx-generator.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });

/**
 * POST /api/parse
 * Body : { dsl: string }
 * Réponse : { diagram?, errors: [] }
 *
 * Utilisé par la preview live côté frontend.
 */
fastify.post<{ Body: { dsl: string } }>(
  '/api/parse',
  async (request, reply) => {
    const { dsl } = request.body;
    if (typeof dsl !== 'string') {
      return reply.code(400).send({ error: 'dsl manquant' });
    }
    const result = parseDsl(dsl);
    if (result.diagram && result.errors.length === 0) {
      await applyLayout(result.diagram);
    }
    return reply.send(result);
  },
);

/**
 * POST /api/generate
 * Body : { dsl: string, stencilMapping?: {...} }
 * Réponse : .vsdx en binaire
 */
fastify.post<{
  Body: { dsl: string; stencilMapping?: Record<string, any> };
}>('/api/generate', async (request, reply) => {
  const { dsl, stencilMapping } = request.body;
  const result = parseDsl(dsl);

  if (!result.diagram || result.errors.length > 0) {
    return reply.code(400).send({ errors: result.errors });
  }

  await applyLayout(result.diagram);
  const buffer = await generateVsdx(result.diagram, stencilMapping);

  reply
    .header(
      'Content-Type',
      'application/vnd.ms-visio.drawing.main+xml',
    )
    .header(
      'Content-Disposition',
      `attachment; filename="${result.diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.vsdx"`,
    )
    .send(buffer);
});

fastify.get('/health', async () => ({ status: 'ok' }));

const port = Number(process.env.PORT) || 3000;
try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`Serveur démarré sur http://localhost:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
