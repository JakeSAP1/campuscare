import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import spec from './openapi.json' with { type: 'json' };
import { api } from './api.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const app = express();
app.use(express.json());
app.use('/api', api);
app.get('/api/openapi.json', (req, res) => res.json(spec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
app.use(express.static(join(root, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CampusCare: http://localhost:${PORT}`);
});
