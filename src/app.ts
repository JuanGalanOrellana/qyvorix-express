import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import router from './routes/index.routes';
import swaggerUI from 'swagger-ui-express';
import YAML from 'yamljs';
import { initPool } from '@/config/db';

const app = express();

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT as string),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  decimalNumbers: true,
};

const swaggerDocument = YAML.load('./openapi.yaml');

initPool(config);

app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
  })
);

app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument));
app.use('/', router);

export default app;
