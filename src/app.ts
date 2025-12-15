import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import hpp from 'hpp';
import swaggerUi from "swagger-ui-express";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

// Config imports
import { corsOptions } from '#config/cors.config.js';
import { compressionOptions } from '#config/compression.config.js';
import { notFoundHandler, globalErrorHandler } from '#config/error-handler.config.js';

import { ApiAuthMiddleware } from 'middlewares/auth.middleware.js';

import transcriptionRoutes from '#routes/transcribe-audio.route.js';

class App {
  public express: express.Application;
  private readonly authMiddleware: ApiAuthMiddleware;

  constructor() {
    this.express = express();
    this.authMiddleware = new ApiAuthMiddleware();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.express.set('trust proxy', true);

    // 보안 헤더
    this.express.use(helmet());

    // CORS (허용되지 않은 origin 조기 차단)
    this.express.use(cors(corsOptions));

    // 요청 파싱 (body parsing)
    this.express.use(express.json());

    // HTTP Parameter Pollution 방어 (파싱된 데이터 검증)
    this.express.use(hpp());

    // 응답 압축
    this.express.use(compression(compressionOptions));
  }

  private initializeRoutes(): void {
    // Health Check
    this.express.get('/health', (req, res) => res.status(200).send('OK'));

    this.express.use('/api', this.authMiddleware.authenticate());

    this.express.use('/api/v1/transcription', transcriptionRoutes);

    if (process.env.NODE_ENV === "development") {
      const specPath = path.join(process.cwd(), "swagger.yml");
      const spec = yaml.load(fs.readFileSync(specPath, "utf8"));

      this.express.use("/docs", (req, res, next) => {
        const host = req.hostname; // "localhost", "127.0.0.1" 등
        if (host === "localhost" || host === "127.0.0.1") return next();
        return res.status(404).end();
      });

      this.express.use("/docs", swaggerUi.serve, swaggerUi.setup(spec as any));
    }
  }


  private initializeErrorHandling(): void {
    // 404 핸들러
    this.express.use(notFoundHandler);

    // 전역 에러 핸들러
    this.express.use(globalErrorHandler);
  }
}

export default new App().express;