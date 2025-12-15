import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, ValidationError, InternalServerError, TooManyRequestsError, ForbiddenError, BadRequestError, ERROR_CODES } from '../utils/errors.js';
import { logger } from '#utils/logger.js';

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  message: string;
  details?: any;
  path?: string;
  timestamp?: string;
  requestId?: string;
}

export const notFoundHandler = (req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    success: false,
    error: 'NotFoundError',
    code: ERROR_CODES.RESOURCE.NOT_FOUND,
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(errorResponse);
};

/**
 * Zod 에러를 ValidationError로 변환
 */
const handleZodError = (error: z.ZodError): ValidationError => {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return new ValidationError({
    message: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
    clientMessage: '입력값이 유효하지 않습니다.',
    code: ERROR_CODES.VALIDATION.INVALID_INPUT,
    details,
  });
};

/**
 * 전역 에러 핸들러
 */
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error: AppError;

  // Zod 검증 에러 처리
  if (err instanceof z.ZodError) {
    error = handleZodError(err);
  }
  // 커스텀 AppError 처리
  else if (err instanceof AppError) {
    error = err;
  }
  // CORS 에러 처리
  else if (err.message.includes('CORS')) {
    error = new ForbiddenError({
      message: `CORS error: ${err.message}`,
      clientMessage: '접근이 허용되지 않았습니다.',
      code: ERROR_CODES.PERMISSION.CORS_NOT_ALLOWED,
    });
  }
  // JSON 파싱 에러 처리
  else if (err instanceof SyntaxError && 'body' in err) {
    error = new BadRequestError({
      message: `Invalid JSON syntax: ${err.message}`,
      clientMessage: '잘못된 JSON 형식입니다.',
      code: ERROR_CODES.VALIDATION.INVALID_JSON,
    });
  }
  else {
    error = new InternalServerError({
      message: err.message || 'Unknown internal error',
      clientMessage: process.env.NODE_ENV === 'production'
        ? '서버에 문제가 발생했습니다.'
        : err.message,
      code: ERROR_CODES.SERVER.INTERNAL_ERROR,
      metadata: {
        stack: err.stack,
        name: err.name,
      },
    });
  }

  const logContext = {
    error: error.message,
    errorCode: error.code,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    ...(error.metadata && { metadata: error.metadata }),
    // 민감한 정보는 로깅하지 않음 (운영 환경)
    ...(process.env.NODE_ENV === 'development' && {
      body: req.body,
      query: req.query,
    }),
  };

  // 5xx 에러는 에러 로그, 4xx 에러는 경고 로그
  if (error.statusCode >= 500) {
    logger.error('서버 에러 발생', { ...logContext, stack: err.stack });
  } else {
    logger.warn('클라이언트 에러 발생', logContext);
  }

  // 에러 응답 생성
  const errorResponse: ErrorResponse = {
    success: false,
    // 5xx 서버 에러는 내부 구조 노출 방지를 위해 일반화
    error: error.statusCode >= 500 ? 'ServerError' : error.constructor.name,
    code: error.code,
    // 클라이언트에는 clientMessage를 반환 (사용자 친화적)
    message: error.clientMessage,
    timestamp: new Date().toISOString(),
    // path는 개발 환경에서만 포함 (디버깅 용도)
    ...(process.env.NODE_ENV === 'development' && { path: req.path }),
  };

  // Validation 에러일 경우 details 추가
  if (error instanceof ValidationError && error.details) {
    errorResponse.details = error.details;
  }

  // Rate limit 에러일 경우 헤더 추가
  if (error instanceof TooManyRequestsError && error.headers) {
    Object.entries(error.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  res.status(error.statusCode).json(errorResponse);
};
