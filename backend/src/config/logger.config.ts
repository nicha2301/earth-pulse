import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';

const logDir = path.join(process.cwd(), 'logs');

export const winstonConfig: WinstonModuleOptions = {
  transports: [
    // Console output with colors for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? `\n${JSON.stringify(meta, null, 2)}`
            : '';
          return `${timestamp} [${context || 'Application'}] ${level}: ${message}${metaStr}`;
        }),
      ),
    }),

    // Error log file - only errors
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.errors({ stack: true }),
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file - all levels
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.errors({ stack: true }),
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 7,
    }),

    // Debug log file - verbose logging for development
    new winston.transports.File({
      filename: path.join(logDir, 'debug.log'),
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],

  // Default metadata
  defaultMeta: {
    service: 'earth-pulse-backend',
    environment: process.env.NODE_ENV || 'development',
  },

  // Exit on error? (false for production)
  exitOnError: false,

  // Log level based on environment
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};
