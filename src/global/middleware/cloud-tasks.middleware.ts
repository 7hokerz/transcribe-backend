import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { ERROR_CODES, UnauthorizedError } from '#global/exception/errors.js';

export class CloudTasksMiddleware {
  private readonly ALLOWED_USER_AGENT = 'Google-Cloud-Tasks' as const;

  constructor(private readonly oauth2Client: OAuth2Client) { }

  authenticate() {
    return async (req: Request, _res: Response, next: NextFunction) => {
      this.validateCloudTasksHeaders(req);
      const token = this.extractBearerToken(req);
      const payload = await this.verifyToken(token, req.originalUrl);
      this.validateServiceAccount(payload);
      next();
    }
  }

  /** Cloud Tasks 필수 헤더 검증 */
  private validateCloudTasksHeaders(req: Request) {
    const queueName = req.header('X-CloudTasks-QueueName');
    const taskName = req.header('X-CloudTasks-TaskName');
    const userAgent = req.get('User-Agent');

    if (!queueName || !taskName || !userAgent?.includes(this.ALLOWED_USER_AGENT)) {
      throw new UnauthorizedError({
        message: `Invalid Cloud Task headers: received="${userAgent}"`,
        clientMessage: '인증이 필요합니다.',
        code: ERROR_CODES.AUTH.USER_AGENT_MISMATCH,
        metadata: { userAgent },
      });
    }
  }

  /** Authorization 헤더에서 Bearer 토큰 추출 */
  private extractBearerToken(req: Request) {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError({
        message: `Missing or invalid token`,
        clientMessage: '인증이 필요합니다.',
        code: ERROR_CODES.AUTH.BEARER_TOKEN_MISSING,
      });
    }

    return authHeader.split(' ')[1]!;
  }

  /** Google OAuth2로 ID 토큰 검증 */
  private async verifyToken(token: string, originalUrl: string) {
    const base = process.env.SERVER_URL!.replace(/\/$/, '');
    const expectedAudience = base + originalUrl;

    const ticket = await this.oauth2Client.verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedError({
        message: `Token payload is empty`,
        clientMessage: '인증이 필요합니다.',
        code: ERROR_CODES.AUTH.INVALID_TOKEN,
      });
    }

    return payload;
  }

  /** Service Account 이메일 검증 */
  private validateServiceAccount(payload: TokenPayload) {
    if (payload.email !== process.env.TASK_SERVICE_ACCOUNT) {
      throw new UnauthorizedError({
        message: `Service account mismatch: expected="${process.env.TASK_SERVICE_ACCOUNT}", received="${payload.email}"`,
        clientMessage: '인증이 필요합니다.',
        code: ERROR_CODES.AUTH.SERVICE_ACCOUNT_MISMATCH,
      });
    }
  }
}