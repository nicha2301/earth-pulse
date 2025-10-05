import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongooseHealth: MongooseHealthIndicator,
    private memoryHealth: MemoryHealthIndicator,
    private diskHealth: DiskHealthIndicator,
    private redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Complete health check - all systems' })
  @ApiResponse({
    status: 200,
    description: 'All systems healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            mongodb: { type: 'object' },
            redis: { type: 'object' },
            memory_heap: { type: 'object' },
            memory_rss: { type: 'object' },
            storage: { type: 'object' },
          },
        },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more systems unhealthy',
  })
  check() {
    return this.health.check([
      () => this.mongooseHealth.pingCheck('mongodb'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.memoryHealth.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memoryHealth.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB
      () => this.diskHealth.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  @Get('mongodb')
  @HealthCheck()
  @ApiOperation({ summary: 'MongoDB health check only' })
  @ApiResponse({ status: 200, description: 'MongoDB is healthy' })
  @ApiResponse({ status: 503, description: 'MongoDB is unhealthy' })
  checkMongoDB() {
    return this.health.check([
      () => this.mongooseHealth.pingCheck('mongodb'),
    ]);
  }

  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Redis health check only' })
  @ApiResponse({ status: 200, description: 'Redis is healthy' })
  @ApiResponse({ status: 503, description: 'Redis is unhealthy' })
  checkRedis() {
    return this.health.check([
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('memory')
  @HealthCheck()
  @ApiOperation({ summary: 'Memory health check only' })
  @ApiResponse({ status: 200, description: 'Memory usage is healthy' })
  @ApiResponse({ status: 503, description: 'Memory usage is critical' })
  checkMemory() {
    return this.health.check([
      () => this.memoryHealth.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memoryHealth.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }

  @Get('disk')
  @HealthCheck()
  @ApiOperation({ summary: 'Disk health check only' })
  @ApiResponse({ status: 200, description: 'Disk usage is healthy' })
  @ApiResponse({ status: 503, description: 'Disk usage is critical' })
  checkDisk() {
    return this.health.check([
      () => this.diskHealth.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe - critical services only' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  checkReady() {
    // Check only critical services for Kubernetes readiness probe
    return this.health.check([
      () => this.mongooseHealth.pingCheck('mongodb'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe - application is running' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  checkLive() {
    // Simple check for Kubernetes liveness probe
    return this.health.check([
      () => this.memoryHealth.checkHeap('memory_heap', 500 * 1024 * 1024), // Higher threshold
    ]);
  }
}
