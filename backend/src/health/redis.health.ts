import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { CacheService } from '../modules/environment/services/cache.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly cacheService: CacheService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();
      
      // Use cache service to test Redis connection
      const testKey = '__health_check__';
      await this.cacheService.set(testKey, { test: true }, 10);
      const result = await this.cacheService.get(testKey);
      await this.cacheService.del(testKey);
      
      const duration = Date.now() - startTime;

      if (result) {
        return this.healthIndicatorService
          .check(key)
          .up({
            status: 'up',
            responseTime: `${duration}ms`,
            connection: 'active',
          });
      } else {
        throw new Error('Failed to set/get test value');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const healthResult = this.healthIndicatorService
        .check(key)
        .down({
          status: 'down',
          error: errorMessage,
          connection: 'failed',
        });
      
      throw new HealthCheckError(
        'Redis health check failed',
        healthResult,
      );
    }
  }
}
