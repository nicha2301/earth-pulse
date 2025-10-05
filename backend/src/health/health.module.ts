import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { CacheService } from '../modules/environment/services/cache.service';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
  ],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    CacheService, // Provide CacheService for RedisHealthIndicator
  ],
})
export class HealthModule {}
