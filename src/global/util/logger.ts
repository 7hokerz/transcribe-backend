
const isDevelopment = process.env.NODE_ENV !== 'production';

enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

/** 로그 컨텍스트 인터페이스 */
interface LogContext {
  [key: string]: any;
}

/** 포맷된 로그 메시지 생성 */
const formatLog = (level: LogLevel, message: string): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
};

class Logger {
  /** 에러 레벨 로그 (항상 출력) */
  error(message: string, context?: LogContext): void {
    const logMessage = formatLog(LogLevel.ERROR, message);
    if (context) {
      console.error(logMessage, context);
    } else {
      console.error(logMessage);
    }
  }

  /** 경고 레벨 로그 (항상 출력) */
  warn(message: string, context?: LogContext): void {
    const logMessage = formatLog(LogLevel.WARN, message);
    if (context) {
      console.warn(logMessage, context);
    } else {
      console.warn(logMessage);
    }
  }

  /** 정보 레벨 로그 (개발 환경에서만 출력) */
  info(message: string, context?: LogContext): void {
    if (isDevelopment) {
      const logMessage = formatLog(LogLevel.INFO, message);
      if (context) {
        console.info(logMessage, context);
      } else {
        console.info(logMessage);
      }
    }
  }

  /** 디버그 레벨 로그 (개발 환경에서만 출력) */
  debug(message: string, context?: LogContext): void {
    if (isDevelopment) {
      const logMessage = formatLog(LogLevel.DEBUG, message);
      if (context) {
        console.debug(logMessage, context);
      } else {
        console.debug(logMessage);
      }
    }
  }
}

export const logger = new Logger();