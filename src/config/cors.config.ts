import { ForbiddenError, ERROR_CODES } from '#utils/errors.js';
import type cors from 'cors';

const API_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8080'
  : ''

/**
 * 허용된 CORS Origin 목록
 */
const allowedOrigins = [
  API_URL,
];

export const corsOptions: cors.CorsOptions = {
  origin(requestOrigin, callback) {
    if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new ForbiddenError({
        message: `CORS origin not allowed: ${requestOrigin}`,
        clientMessage: '접근이 허용되지 않은 도메인입니다.',
        code: ERROR_CODES.PERMISSION.CORS_NOT_ALLOWED,
        metadata: { requestOrigin },
      }));
    }
  },
};
