import { HttpModuleOptions } from '@nestjs/axios';
import { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { Logger } from '@nestjs/common';

const logger = new Logger('HttpConfig');

/**
 * Default HTTP configuration for all axios instances
 */
export const httpConfig: HttpModuleOptions = {
  timeout: 10000, // 10 seconds
  maxRedirects: 5,
  headers: {
    'User-Agent': 'EarthPulse-Backend/1.0',
  },
};

/**
 * Setup axios retry with exponential backoff
 * @param axiosInstance - The axios instance to configure
 * @param options - Optional configuration
 */
export function setupAxiosRetry(
  axiosInstance: AxiosInstance,
  options?: {
    retries?: number;
    retryDelay?: number;
    onRetry?: (retryCount: number, error: any, requestConfig: any) => void;
  },
) {
  const retries = options?.retries || 3;
  const baseDelay = options?.retryDelay || 1000;

  axiosRetry(axiosInstance, {
    retries,
    
    // Exponential backoff: 1s, 2s, 4s, 8s...
    retryDelay: (retryCount) => {
      const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 10000);
      logger.debug(`Retry delay: ${delay}ms (attempt ${retryCount}/${retries})`);
      return delay;
    },
    
    // Retry conditions
    retryCondition: (error) => {
      // Retry on network errors
      if (axiosRetry.isNetworkError(error)) {
        logger.warn(`Network error detected, will retry: ${error.message}`);
        return true;
      }

      // Retry on 5xx server errors
      if (error.response?.status) {
        if (error.response.status >= 500 && error.response.status < 600) {
          logger.warn(`Server error ${error.response.status} detected, will retry`);
          return true;
        }

        // Retry on 429 (Too Many Requests)
        if (error.response.status === 429) {
          logger.warn('Rate limit hit (429), will retry');
          return true;
        }
      }

      // Retry on timeout
      if (error.code === 'ECONNABORTED') {
        logger.warn('Request timeout, will retry');
        return true;
      }

      return false;
    },
    
    // Logging
    onRetry: (retryCount, error, requestConfig) => {
      const url = requestConfig.url;
      const method = requestConfig.method?.toUpperCase();
      const status = error.response?.status || 'N/A';
      
      logger.warn(
        `Retry attempt ${retryCount}/${retries} for ${method} ${url}`,
        {
          retryCount,
          status,
          errorMessage: error.message,
          url,
          method,
        },
      );

      // Call custom onRetry callback if provided
      if (options?.onRetry) {
        options.onRetry(retryCount, error, requestConfig);
      }
    },
  });

  logger.log(`Axios retry configured: ${retries} retries with exponential backoff`);
}

/**
 * Create axios instance with retry enabled
 */
export function createAxiosWithRetry(
  config?: HttpModuleOptions,
  retryOptions?: {
    retries?: number;
    retryDelay?: number;
  },
): AxiosInstance {
  const axios = require('axios');
  const instance = axios.create({
    ...httpConfig,
    ...config,
  });

  setupAxiosRetry(instance, retryOptions);
  return instance;
}
