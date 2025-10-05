import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import {
  circuitBreakerConfigs,
  CircuitBreakerEvents,
  createCircuitBreaker,
} from '../../../config/circuit-breaker.config';

/**
 * Circuit Breaker Service
 * 
 * Manages circuit breakers for all external API services.
 * Prevents cascading failures by opening circuit when errors exceed threshold.
 */

export interface CircuitBreakerStats {
  name: string;
  state: 'open' | 'closed' | 'half-open';
  stats: {
    fires: number;           // Total requests
    successes: number;       // Successful requests
    failures: number;        // Failed requests
    timeouts: number;        // Timed out requests
    fallbacks: number;       // Fallback executions
    rejects: number;         // Rejected (circuit open)
    cacheHits: number;       // Cache hits
    cacheMisses: number;     // Cache misses
    semaphoreRejections: number;  // Too many concurrent
    percentiles: any;        // Percentile stats
    latencyMean: number;     // Average latency
    latencyTimes: number[];  // Recent latency samples
  };
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker<any[], any>>();

  constructor() {
    this.initializeCircuitBreakers();
  }

  /**
   * Initialize circuit breakers for all external services
   */
  private initializeCircuitBreakers(): void {
    const services = ['aqicn', 'openweather', 'firms', 'noaa', 'nsidc'];

    services.forEach((service) => {
      // Circuit breakers will be created on-demand
      // This just logs that the service is ready
      this.logger.log(`📡 Circuit breaker ready for ${service} service`);
    });
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getCircuitBreaker<T extends any[], R>(
    serviceName: string,
    action: (...args: T) => Promise<R>,
    fallback?: (...args: T) => Promise<R>,
  ): CircuitBreaker<T, R> {
    // Return existing breaker if available
    if (this.breakers.has(serviceName)) {
      return this.breakers.get(serviceName) as CircuitBreaker<T, R>;
    }

    // Get service-specific config or use default
    const config = circuitBreakerConfigs[serviceName] || {
      name: `${serviceName} Circuit Breaker`,
    };

    // Create new circuit breaker
    const breaker = createCircuitBreaker<T, R>(action, config);

    // Set fallback if provided
    if (fallback) {
      breaker.fallback(fallback);
    }

    // Setup event listeners for logging and monitoring
    this.setupEventListeners(breaker, serviceName);

    // Store breaker
    this.breakers.set(serviceName, breaker);

    this.logger.log(`✅ Circuit breaker created for ${serviceName}`);

    return breaker;
  }

  /**
   * Execute an action through a circuit breaker
   */
  async execute<T extends any[], R>(
    serviceName: string,
    action: (...args: T) => Promise<R>,
    args: T,
    fallback?: (...args: T) => Promise<R>,
  ): Promise<R> {
    const breaker = this.getCircuitBreaker(serviceName, action, fallback);
    return breaker.fire(...args);
  }

  /**
   * Setup event listeners for monitoring and logging
   */
  private setupEventListeners(
    breaker: CircuitBreaker<any[], any>,
    serviceName: string,
  ): void {
    // Circuit opened - service is failing
    breaker.on('open' as any, () => {
      this.logger.error(
        `🔴 Circuit OPENED for ${serviceName} - Too many failures, requests will be rejected`,
      );
    });

    // Circuit closed - service recovered
    breaker.on('close' as any, () => {
      this.logger.log(
        `🟢 Circuit CLOSED for ${serviceName} - Service recovered, normal operation resumed`,
      );
    });

    // Circuit half-open - testing if service recovered
    breaker.on('halfOpen' as any, () => {
      this.logger.warn(
        `🟡 Circuit HALF-OPEN for ${serviceName} - Testing service recovery...`,
      );
    });

    // Request succeeded
    breaker.on('success' as any, (result: any, latency: any) => {
      this.logger.debug(
        `✅ ${serviceName} request succeeded (${latency}ms)`,
      );
    });

    // Request failed
    breaker.on('failure' as any, (error: any) => {
      this.logger.warn(
        `❌ ${serviceName} request failed: ${error.message}`,
      );
    });

    // Request timed out
    breaker.on('timeout' as any, () => {
      this.logger.warn(
        `⏱️ ${serviceName} request timed out`,
      );
    });

    // Fallback executed
    breaker.on('fallback' as any, (result: any) => {
      this.logger.warn(
        `🔄 ${serviceName} fallback executed`,
      );
    });

    // Too many concurrent requests
    breaker.on('semaphoreLocked' as any, () => {
      this.logger.warn(
        `🚫 ${serviceName} rejected - Too many concurrent requests`,
      );
    });
  }

  /**
   * Get circuit breaker statistics for a service
   */
  getStats(serviceName: string): CircuitBreakerStats | null {
    const breaker = this.breakers.get(serviceName);
    if (!breaker) {
      return null;
    }

    const stats = breaker.stats;
    const state = breaker.opened
      ? 'open'
      : breaker.halfOpen
      ? 'half-open'
      : 'closed';

    return {
      name: serviceName,
      state,
      stats: {
        fires: stats.fires,
        successes: stats.successes,
        failures: stats.failures,
        timeouts: stats.timeouts,
        fallbacks: stats.fallbacks,
        rejects: stats.rejects,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        semaphoreRejections: stats.semaphoreRejections,
        percentiles: stats.percentiles,
        latencyMean: stats.latencyMean,
        latencyTimes: stats.latencyTimes,
      },
    };
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const allStats: Record<string, CircuitBreakerStats> = {};

    this.breakers.forEach((breaker, serviceName) => {
      const stats = this.getStats(serviceName);
      if (stats) {
        allStats[serviceName] = stats;
      }
    });

    return allStats;
  }

  /**
   * Check if a circuit breaker is open
   */
  isOpen(serviceName: string): boolean {
    const breaker = this.breakers.get(serviceName);
    return breaker ? breaker.opened : false;
  }

  /**
   * Check if a circuit breaker is half-open
   */
  isHalfOpen(serviceName: string): boolean {
    const breaker = this.breakers.get(serviceName);
    return breaker ? breaker.halfOpen : false;
  }

  /**
   * Check if a circuit breaker is closed (healthy)
   */
  isClosed(serviceName: string): boolean {
    const breaker = this.breakers.get(serviceName);
    return breaker ? !breaker.opened && !breaker.halfOpen : true;
  }

  /**
   * Manually open a circuit breaker
   */
  open(serviceName: string): void {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.open();
      this.logger.warn(`⚠️ Manually opened circuit for ${serviceName}`);
    }
  }

  /**
   * Manually close a circuit breaker
   */
  close(serviceName: string): void {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.close();
      this.logger.log(`✅ Manually closed circuit for ${serviceName}`);
    }
  }

  /**
   * Shutdown a circuit breaker
   */
  shutdown(serviceName: string): void {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.shutdown();
      this.breakers.delete(serviceName);
      this.logger.log(`🛑 Shutdown circuit breaker for ${serviceName}`);
    }
  }

  /**
   * Shutdown all circuit breakers
   */
  shutdownAll(): void {
    this.breakers.forEach((breaker, serviceName) => {
      breaker.shutdown();
      this.logger.log(`🛑 Shutdown circuit breaker for ${serviceName}`);
    });
    this.breakers.clear();
  }

  /**
   * Clear statistics for a service
   */
  clearStats(serviceName: string): void {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.clearCache();
      this.logger.log(`🧹 Cleared stats for ${serviceName}`);
    }
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): {
    healthy: boolean;
    services: Record<string, { state: string; healthy: boolean }>;
  } {
    const services: Record<string, { state: string; healthy: boolean }> = {};
    let allHealthy = true;

    this.breakers.forEach((breaker, serviceName) => {
      const state = breaker.opened
        ? 'open'
        : breaker.halfOpen
        ? 'half-open'
        : 'closed';
      const healthy = state === 'closed';

      services[serviceName] = { state, healthy };

      if (!healthy) {
        allHealthy = false;
      }
    });

    return {
      healthy: allHealthy,
      services,
    };
  }
}
