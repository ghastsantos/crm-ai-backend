import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';

/** Em `dist/`, só existem `*.routes.js`; em `src/` (ts-node), `*.routes.ts`. */
function routeFilesGlobForSwagger(): string {
  const runningFromDist = __dirname.includes(`${path.sep}dist${path.sep}`);
  const ext = runningFromDist ? 'js' : 'ts';
  return path.join(__dirname, '..', 'modules', '**', `*.routes.${ext}`);
}

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CRM Backend API',
      version: '1.0.0',
      description: 'API do backend do CRM',
    },
    servers: [
      {
        url: '/',
        description: 'Current host',
      },
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Auth', description: 'Authentication' },
      { name: 'Cards', description: 'Cards (Deals) management' },
      { name: 'PipelineColumns', description: 'Pipeline columns per organization' },
      { name: 'WhatsApp', description: 'WhatsApp message intake' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'crm_access_token',
          description: 'HTTP-only session cookie (set on login/register when enabled)',
        },
      },
    },
  },
  apis: [routeFilesGlobForSwagger()],
};

const spec = swaggerJsdoc(options);

export const apiDocsRouter = Router();
apiDocsRouter.use('/', swaggerUi.serve);
apiDocsRouter.get('/', swaggerUi.setup(spec, { explorer: true }));
