import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CRM AI Backend API',
      version: '1.0.0',
      description: 'API do backend principal do CRM com IA',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Test', description: 'Test endpoints' },
    ],
  },
  apis: [path.join(__dirname, '../modules/**/*.routes.ts')],
};

const spec = swaggerJsdoc(options);

export const apiDocsRouter = Router();
apiDocsRouter.use('/', swaggerUi.serve);
apiDocsRouter.get('/', swaggerUi.setup(spec, { explorer: true }));
