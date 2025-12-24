import { OAuth2Client } from 'google-auth-library';
import type { Request, Response, NextFunction } from 'express';
import { ERROR_CODES, UnauthorizedError } from '#utils/errors.js';

export class CloudTasksMiddleware {
  private readonly client = new OAuth2Client();
  private readonly ALLOWED_USER_AGENT = 'Google-Cloud-Tasks' as const;

  authenticate() {
    return async (req: Request, _res: Response, next: NextFunction) => {
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

      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError({
          message: `Missing or invalid token`,
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.BEARER_TOKEN_MISSING,
        });
      }

      const token = authHeader.split(' ')[1]!;
      const base = process.env.SERVER_URL!.replace(/\/$/, '');
      const expectedAudience = base + req.originalUrl; 

      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: expectedAudience,
      });

      const payload = ticket.getPayload();
      if (payload?.email !== process.env.TASK_SERVICE_ACCOUNT) {
        throw new UnauthorizedError({
          message: `Service account mismatch`,
          clientMessage: '인증이 필요합니다.',
          code: ERROR_CODES.AUTH.SERVICE_ACCOUNT_MISMATCH,
        });
      }

      next();
    }
  }
}