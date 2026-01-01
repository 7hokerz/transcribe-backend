import {
  ServiceUnavailableError,
  GatewayTimeoutError,
  BadGatewayError,
  InternalServerError,
  ERROR_CODES,
  AppError
} from "./errors.js";


/**
 * 외부 인프라(GCP, DB) 에러를 적절한 AppError로 변환
 */
export function mapToInfrastructureError(e: any): AppError {
  const code = e?.code;
  const message = e?.message || 'Unknown infrastructure error';

  // 1. 타임아웃 계열 (재시도 대상 -> 504 Gateway Timeout)
  // 4: DEADLINE_EXCEEDED
  const TIMEOUT_CODES = [4, 'DEADLINE_EXCEEDED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'];
  if (TIMEOUT_CODES.includes(code)) {
    return new GatewayTimeoutError({
      message: `Infrastructure timeout: ${message}`,
      code: ERROR_CODES.EXTERNAL.GATEWAY_TIMEOUT,
      metadata: { originalError: e }
    });
  }

  // 2. 서비스 불가 계열 (재시도 대상 -> 503 Service Unavailable)
  // 14: UNAVAILABLE
  const UNAVAILABLE_CODES = [14, 'UNAVAILABLE', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE'];
  if (UNAVAILABLE_CODES.includes(code)) {
    return new ServiceUnavailableError({
      message: `Infrastructure unavailable: ${message}`,
      code: ERROR_CODES.EXTERNAL.SERVICE_UNAVAILABLE,
      metadata: { originalError: e }
    });
  }

  // 3. 알 수 없는 내부 오류 계열 (재시도 대상 -> 502 Bad Gateway)
  // 13: INTERNAL, 2: UNKNOWN
  const INTERNAL_CODES = [13, 2, 'INTERNAL', 'UNKNOWN'];
  if (INTERNAL_CODES.includes(code)) {
    return new BadGatewayError({
      message: `Infrastructure internal error: ${message}`,
      code: ERROR_CODES.EXTERNAL.SERVICE_UNAVAILABLE,
      metadata: { originalError: e }
    });
  }

  // 4. 재시도 금지 (Fatal) 계열 (개발자 수정 필요 -> 500 Internal Server Error)
  // 3: INVALID_ARGUMENT, 5: NOT_FOUND, 7: PERMISSION_DENIED
  // 16: UNAUTHENTICATED, 6: ALREADY_EXISTS (로직에 따라 다름)
  // 여기서 처리되지 않은 에러는 모두 Fatal로 간주하여 아래에서 기본값으로 처리됨

  // 기본값: 명확히 분류되지 않은 에러는 시스템 설정 오류나 버그로 간주 (재시도 X)
  return new InternalServerError({
    message: `Fatal infrastructure error (code: ${code}): ${message}`,
    clientMessage: '작업 요청 중 시스템 오류가 발생했습니다.',
    code: ERROR_CODES.SERVER.CONFIGURATION_ERROR,
    isOperational: false, // 개발자 개입 필요
    metadata: { originalError: e, code }
  });
}
