import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { adminDatabase } from '#config/firebase-admin.js';
import admin from 'firebase-admin';
import { UnauthorizedError, InternalServerError, ERROR_CODES } from '#utils/errors.js';

export class ApiAuthMiddleware {
  private readonly CLOCK_SKEW_TOLERANCE = 5 * 60 * 1000; // 타임스탬프 검증
  private readonly NONCE_TTL = 5 * 60 * 1000; // 논스 유효 시간
  private readonly ALLOWED_USER_AGENT = 'QuizGenApp/1.0';

  authenticate() {
    return async (req: Request, _res: Response, next: NextFunction) => {
      // User-Agent 검증
      const userAgent = req.get('User-Agent');
      const clientIp = this.getClientIp(req);

      console.log(`Request received from client IP: ${clientIp}`);

      if (userAgent !== this.ALLOWED_USER_AGENT) {
        throw new UnauthorizedError({
          message: `User-Agent mismatch: expected="${this.ALLOWED_USER_AGENT}", received="${userAgent}"`,
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.USER_AGENT_MISMATCH,
          metadata: { userAgent, expected: this.ALLOWED_USER_AGENT },
        });
      }

      const signature = req.get('X-Signature');
      const timestamp = req.get('X-Timestamp');
      const nonce = req.get('X-Nonce');

      if (!signature || !timestamp || !nonce) {
        throw new UnauthorizedError({
          message: `Missing required headers: signature=${!!signature}, timestamp=${!!timestamp}, nonce=${!!nonce}`,
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.MISSING_CREDENTIALS,
          metadata: { hasSignature: !!signature, hasTimestamp: !!timestamp, hasNonce: !!nonce },
        });
      }

      // hex 형식 검증
      if (!/^[0-9a-f]{64}$/i.test(signature)) {
        throw new UnauthorizedError({
          message: `Invalid signature format: expected 64 hex characters, received ${signature.length} characters`,
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.INVALID_SIGNATURE,
          metadata: { signatureLength: signature.length },
        });
      }

      // 타임스탬프 검증
      if (!this.isTimestampValid(timestamp)) {
        const now = Date.now();
        const diff = Math.abs(now - parseInt(timestamp));
        throw new UnauthorizedError({
          message: `Timestamp validation failed: time difference=${diff}ms (max allowed=${this.CLOCK_SKEW_TOLERANCE}ms)`,
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.INVALID_TIMESTAMP,
          metadata: { timestamp, timeDiff: diff, maxAllowed: this.CLOCK_SKEW_TOLERANCE },
        });
      }

      const serverSecret = process.env.API_SECRET_KEY;
      if (!serverSecret) {
        throw new InternalServerError({
          message: 'API_SECRET_KEY environment variable is not configured',
          clientMessage: '서버 설정 오류가 발생했습니다.',
          code: ERROR_CODES.SERVER.CONFIGURATION_ERROR,
        });
      }

      // HMAC 서명 검증
      const body = req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body)
        : '';

      const expectedSignature = this.generateHMACSignature(
        serverSecret,
        req.method,
        req.path,
        body,
        timestamp,
        nonce
      );

      if (signature.length !== expectedSignature.length) {
        throw new UnauthorizedError({
          message: `Signature length mismatch: received=${signature.length}, expected=${expectedSignature.length}`,
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.INVALID_SIGNATURE,
          metadata: { receivedLength: signature.length, expectedLength: expectedSignature.length },
        });
      }

      const signatureValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!signatureValid) {
        throw new UnauthorizedError({
          message: 'HMAC signature verification failed',
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.INVALID_SIGNATURE,
          metadata: { method: req.method, path: req.path },
        });
      }

      // 논스값 검증 (개발 환경에서는 비활성화)
      if (process.env.NODE_ENV !== 'development') {
        const nonceValid = await this.validateNonce(nonce);
        if (!nonceValid) {
          throw new UnauthorizedError({
            message: `Nonce validation failed: nonce="${nonce}"`,
            clientMessage: '인증이 필요합니다.',
            code: ERROR_CODES.AUTH.NONCE_VERIFICATION_FAILED,
            metadata: { nonce },
          });
        }
      }

      return next();
    }
  }

  private generateHMACSignature(
    secret: string,
    method: string,
    path: string,
    body: string,
    timestamp: string,
    nonce: string
  ): string {
    const message = `${method.toUpperCase()}${path}${body}${timestamp}${nonce}`;

    return crypto
      .createHmac('sha256', secret)
      .update(message, 'utf8')
      .digest('hex');
  }

  private isTimestampValid(timestamp: string): boolean {
    const now = Date.now();
    const requestTime = parseInt(timestamp);

    // 숫자가 아니거나 미래/과거 5분을 벗어나면 거부
    if (isNaN(requestTime)) return false;

    const timeDiff = Math.abs(now - requestTime);
    return timeDiff <= this.CLOCK_SKEW_TOLERANCE;
  }

  private async validateNonce(nonce: string): Promise<boolean> {
    if (!nonce || nonce.length !== 32 || !/^[0-9a-f]{32}$/i.test(nonce)) return false;

    try {
      const nonceRef = adminDatabase.ref(`nonces/${nonce}`);

      const result = await nonceRef.transaction((currentData) => {
        if (currentData !== null) {
          return null;
        }

        return {
          used: true,
          createdAt: admin.database.ServerValue.TIMESTAMP,
          expiresAt: Date.now() + this.NONCE_TTL,
        };
      })

      return result.committed && result.snapshot.val() !== null;
    } catch (error) {
      return false;
    }
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];

    if (typeof forwarded === 'string') {
      const firstIp = forwarded.split(',')[0]?.trim();
      if (firstIp) {
        return firstIp;
      }
    }

    if (Array.isArray(forwarded) && forwarded[0]) {
      return forwarded[0];
    }

    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
      return realIp;
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
