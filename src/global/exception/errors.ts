/**
 * 에러 코드 상수 정의
 * 카테고리별로 그룹화하여 체계적인 에러 관리
 */
export const ERROR_CODES = {
  // 인증 관련 (AUTH_*)
  AUTH: {
    UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
    INVALID_SIGNATURE: 'AUTH_INVALID_SIGNATURE',
    INVALID_TIMESTAMP: 'AUTH_INVALID_TIMESTAMP',
    MISSING_CREDENTIALS: 'AUTH_MISSING_CREDENTIALS',
    USER_AGENT_MISMATCH: 'AUTH_USER_AGENT_MISMATCH',
    BEARER_TOKEN_MISSING: 'AUTH_BEARER_TOKEN_MISSING',
    OIDC_PAYLOAD_EMPTY: 'AUTH_OIDC_PAYLOAD_EMPTY',
    SERVICE_ACCOUNT_MISMATCH: 'AUTH_SERVICE_ACCOUNT_MISMATCH',
    NONCE_VERIFICATION_FAILED: 'AUTH_NONCE_VERIFICATION_FAILED',
  },
  // 검증 관련 (VALIDATION_*)
  VALIDATION: {
    INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
    INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
    MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
    INVALID_JSON: 'VALIDATION_INVALID_JSON',
  },
  // 리소스 관련 (RESOURCE_*)
  RESOURCE: {
    NOT_FOUND: 'RESOURCE_NOT_FOUND',
    USER_NOT_FOUND: 'RESOURCE_USER_NOT_FOUND',
    PAYMENT_NOT_FOUND: 'RESOURCE_PAYMENT_NOT_FOUND',
    PLAN_NOT_FOUND: 'RESOURCE_PLAN_NOT_FOUND',
    REFUND_NOT_FOUND: 'RESOURCE_REFUND_NOT_FOUND',
    SUBSCRIPTION_NOT_FOUND: 'RESOURCE_SUBSCRIPTION_NOT_FOUND',
    ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  },
  // 권한 관련 (PERMISSION_*)
  PERMISSION: {
    FORBIDDEN: 'PERMISSION_FORBIDDEN',
    CORS_NOT_ALLOWED: 'PERMISSION_CORS_NOT_ALLOWED',
    ACCESS_DENIED: 'PERMISSION_ACCESS_DENIED',
  },
  // 비즈니스 로직 관련 (BUSINESS_*)
  BUSINESS: {
    CONFLICT: 'BUSINESS_CONFLICT',
    DUPLICATE_ORDER: 'BUSINESS_DUPLICATE_ORDER',
    PAYMENT_IN_PROGRESS: 'BUSINESS_PAYMENT_IN_PROGRESS',
    ALREADY_PREMIUM: 'BUSINESS_ALREADY_PREMIUM',
    INVALID_STATE: 'BUSINESS_INVALID_STATE',
    INVALID_STATE_TRANSITION: 'BUSINESS_INVALID_STATE_TRANSITION',
    PAYMENT_ALREADY_COMPLETED: 'BUSINESS_PAYMENT_ALREADY_COMPLETED',
    REFUND_IN_PROGRESS: 'BUSINESS_REFUND_IN_PROGRESS',
    MISSING_TRANSACTION_DATA: 'BUSINESS_MISSING_TRANSACTION_DATA',
  },
  // 외부 서비스 관련 (EXTERNAL_*)
  EXTERNAL: {
    PG_APPROVAL_FAILED: 'EXTERNAL_PG_APPROVAL_FAILED',
    PG_CANCEL_FAILED: 'EXTERNAL_PG_CANCEL_FAILED',
    PG_REFUND_FAILED: 'EXTERNAL_PG_REFUND_FAILED',
    SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
    GATEWAY_TIMEOUT: 'EXTERNAL_GATEWAY_TIMEOUT',
    MAIL_SEND_FAILED: 'EXTERNAL_MAIL_SEND_FAILED',
    AI_MODEL_FAILED: 'EXTERNAL_AI_MODEL_FAILED',
  },
  // Rate Limit 관련 (RATE_LIMIT_*)
  RATE_LIMIT: {
    TOO_MANY_REQUESTS: 'RATE_LIMIT_TOO_MANY_REQUESTS',
    QUOTA_EXCEEDED: 'RATE_LIMIT_QUOTA_EXCEEDED',
  },
  // 서버 관련 (SERVER_*)
  SERVER: {
    INTERNAL_ERROR: 'SERVER_INTERNAL_ERROR',
    CONFIGURATION_ERROR: 'SERVER_CONFIGURATION_ERROR',
    DATABASE_ERROR: 'SERVER_DATABASE_ERROR',
  },
} as const;

/**
 * 에러 코드 타입 정의
 */
export type ErrorCode =
  | (typeof ERROR_CODES.AUTH)[keyof typeof ERROR_CODES.AUTH]
  | (typeof ERROR_CODES.VALIDATION)[keyof typeof ERROR_CODES.VALIDATION]
  | (typeof ERROR_CODES.RESOURCE)[keyof typeof ERROR_CODES.RESOURCE]
  | (typeof ERROR_CODES.PERMISSION)[keyof typeof ERROR_CODES.PERMISSION]
  | (typeof ERROR_CODES.BUSINESS)[keyof typeof ERROR_CODES.BUSINESS]
  | (typeof ERROR_CODES.EXTERNAL)[keyof typeof ERROR_CODES.EXTERNAL]
  | (typeof ERROR_CODES.RATE_LIMIT)[keyof typeof ERROR_CODES.RATE_LIMIT]
  | (typeof ERROR_CODES.SERVER)[keyof typeof ERROR_CODES.SERVER];

/**
 * 커스텀 에러 클래스들
 * HTTP 상태 코드와 함께 에러를 정의하여 중앙화된 에러 처리 지원
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: ErrorCode;
  public readonly clientMessage: string;
  public readonly metadata?: Record<string, any>;

  constructor(config: {
    message: string; // 내부 로그용 (개발자가 보는 상세 메시지)
    clientMessage: string; // 클라이언트용 (사용자가 보는 메시지)
    statusCode: number;
    code: ErrorCode;
    metadata?: Record<string, any>; // 로깅용 추가 정보
    isOperational?: boolean; // 예상된 에러인지 여부
  }) {
    super(config.message);
    this.clientMessage = config.clientMessage;
    this.statusCode = config.statusCode;
    this.code = config.code;
    if (config.metadata) {
      this.metadata = config.metadata;
    }
    this.isOperational = config.isOperational ?? true;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ========================================================================================
// HTTP 4xx 클라이언트 에러
// ========================================================================================

/**
 * 400 Bad Request
 * 잘못된 요청으로 인한 에러
 */
export class BadRequestError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '잘못된 요청입니다.',
      statusCode: 400,
      code: config.code ?? ERROR_CODES.VALIDATION.INVALID_INPUT,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 Unauthorized
 * 인증 실패로 인한 에러
 */
export class UnauthorizedError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '인증이 필요합니다.',
      statusCode: 401,
      code: config.code ?? ERROR_CODES.AUTH.UNAUTHORIZED,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden
 * 권한 부족으로 인한 에러
 */
export class ForbiddenError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '접근 권한이 없습니다.',
      statusCode: 403,
      code: config.code ?? ERROR_CODES.PERMISSION.FORBIDDEN,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found
 * 리소스를 찾을 수 없는 에러
 */
export class NotFoundError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '리소스를 찾을 수 없습니다.',
      statusCode: 404,
      code: config.code ?? ERROR_CODES.RESOURCE.NOT_FOUND,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict
 * 리소스 충돌로 인한 에러
 */
export class ConflictError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '리소스 충돌이 발생했습니다.',
      statusCode: 409,
      code: config.code ?? ERROR_CODES.BUSINESS.CONFLICT,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 * 입력값 검증 실패로 인한 에러
 */
export class ValidationError extends AppError {
  public readonly details?: any;

  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    details?: any;
    metadata?: Record<string, any>;
  }) {
    const combinedMetadata = config.details || config.metadata
      ? { ...config.metadata, ...(config.details && { details: config.details }) }
      : undefined;

    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '입력값이 유효하지 않습니다.',
      statusCode: 422,
      code: config.code ?? ERROR_CODES.VALIDATION.INVALID_INPUT,
      ...(combinedMetadata && { metadata: combinedMetadata }),
    });
    this.details = config.details;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 429 Too Many Requests
 * Rate Limit 초과로 인한 에러
 */
export class TooManyRequestsError extends AppError {
  public readonly headers: Record<string, string> | undefined;

  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    headers?: Record<string, string>;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '너무 많은 요청이 발생했습니다.',
      statusCode: 429,
      code: config.code ?? ERROR_CODES.RATE_LIMIT.TOO_MANY_REQUESTS,
      ...(config.metadata && { metadata: config.metadata }),
    });
    this.headers = config.headers;
    Object.setPrototypeOf(this, TooManyRequestsError.prototype);
  }
}

// ========================================================================================
// HTTP 5xx 서버 에러
// ========================================================================================

/**
 * 500 Internal Server Error
 * 서버 내부 에러
 */
export class InternalServerError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
    isOperational?: boolean;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '서버에 문제가 발생했습니다.',
      statusCode: 500,
      code: config.code ?? ERROR_CODES.SERVER.INTERNAL_ERROR,
      isOperational: config.isOperational ?? false,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 502 Bad Gateway
 * 외부 서비스 연결 실패로 인한 에러
 */
export class BadGatewayError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '외부 서비스 연결에 실패했습니다.',
      statusCode: 502,
      code: config.code ?? ERROR_CODES.EXTERNAL.SERVICE_UNAVAILABLE,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, BadGatewayError.prototype);
  }
}

/**
 * 503 Service Unavailable
 * 서비스 일시 중단으로 인한 에러
 */
export class ServiceUnavailableError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '서비스를 일시적으로 사용할 수 없습니다.',
      statusCode: 503,
      code: config.code ?? ERROR_CODES.EXTERNAL.SERVICE_UNAVAILABLE,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * 504 Gateway Timeout
 * 외부 서비스 타임아웃으로 인한 에러
 */
export class GatewayTimeoutError extends AppError {
  constructor(config: {
    message: string;
    clientMessage?: string;
    code?: ErrorCode;
    metadata?: Record<string, any>;
  }) {
    super({
      message: config.message,
      clientMessage: config.clientMessage ?? '외부 서비스 응답 시간이 초과되었습니다.',
      statusCode: 504,
      code: config.code ?? ERROR_CODES.EXTERNAL.GATEWAY_TIMEOUT,
      ...(config.metadata && { metadata: config.metadata }),
    });
    Object.setPrototypeOf(this, GatewayTimeoutError.prototype);
  }
}
