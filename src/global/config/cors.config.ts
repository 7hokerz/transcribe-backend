import type cors from 'cors';
import { ForbiddenError, ERROR_CODES } from '#global/exception/errors.js';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 허용된 CORS Origin 목록
 */
const allowedOrigins = [
  // 로컬 개발 환경
  ...(isDevelopment ? [
    'http://localhost:8080',
  ] : []),

  // 프로덕션 환경 (환경변수로 관리)
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

  credentials: true, // 쿠키/인증 헤더 허용
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
  maxAge: 86400, // preflight 캐싱 (24시간)
};
