import { Injectable, Logger } from '@nestjs/common';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string | undefined>;
}

export interface MetricsSummary {
  timeRange: string;
  cache: {
    hits: number;
    misses: number;
    total: number;
    hitRate: string;
  };
  api: {
    totalRequests: number;
    avgResponseTime: string;
    p95ResponseTime: string;
    p99ResponseTime: string;
  };
  database: {
    totalQueries: number;
    avgQueryTime: string;
    slowQueries: number;
  };
  collections: {
    totalJobs: number;
    successRate: string;
    avgDuration: string;
    failedJobs: number;
  };
  externalApis: {
    totalCalls: number;
    successRate: string;
    avgDuration: string;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: Metric[] = [];
  private readonly MAX_METRICS = 10000; // Keep last 10k metrics

  constructor() {
    // Cleanup old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
  }

  /**
   * Track API response time
   */
  trackResponseTime(endpoint: string, duration: number, statusCode: number) {
    this.logger.debug(`API Response: ${endpoint} - ${duration}ms - ${statusCode}`, {
      metric: 'api_response_time',
      endpoint,
      duration,
      statusCode,
    });

    this.addMetric({
      name: 'api.response_time',
      value: duration,
      timestamp: new Date(),
      tags: { endpoint, statusCode: String(statusCode) },
    });
  }

  /**
   * Track cache hit/miss
   */
  trackCacheAccess(key: string, hit: boolean) {
    this.logger.debug(`Cache ${hit ? 'HIT' : 'MISS'}: ${key}`, {
      metric: 'cache_access',
      key,
      hit,
    });

    this.addMetric({
      name: 'cache.access',
      value: hit ? 1 : 0,
      timestamp: new Date(),
      tags: { key, type: hit ? 'hit' : 'miss' },
    });
  }

  /**
   * Track database query
   */
  trackDatabaseQuery(
    collection: string,
    operation: string,
    duration: number,
    recordCount?: number,
  ) {
    const isSlow = duration > 100;

    if (isSlow) {
      this.logger.warn(
        `Slow DB Query: ${collection}.${operation} - ${duration}ms`,
        {
          metric: 'slow_db_query',
          collection,
          operation,
          duration,
          recordCount,
        },
      );
    } else {
      this.logger.debug(`DB Query: ${collection}.${operation} - ${duration}ms`, {
        metric: 'db_query',
        collection,
        operation,
        duration,
        recordCount,
      });
    }

    this.addMetric({
      name: 'db.query_time',
      value: duration,
      timestamp: new Date(),
      tags: {
        collection,
        operation,
        slow: String(isSlow),
        recordCount: recordCount ? String(recordCount) : undefined,
      },
    });
  }

  /**
   * Track data collection job
   */
  trackCollectionJob(
    source: string,
    duration: number,
    success: boolean,
    recordsCollected: number,
    error?: string,
  ) {
    const level = success ? 'log' : 'error';

    this.logger[level](
      `Collection Job: ${source} - ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms - ${recordsCollected} records`,
      {
        metric: 'collection_job',
        source,
        duration,
        success,
        recordsCollected,
        error,
      },
    );

    this.addMetric({
      name: 'collection.duration',
      value: duration,
      timestamp: new Date(),
      tags: {
        source,
        success: String(success),
        recordsCollected: String(recordsCollected),
      },
    });
  }

  /**
   * Track external API call
   */
  trackExternalApiCall(
    service: string,
    endpoint: string,
    duration: number,
    success: boolean,
    statusCode?: number,
  ) {
    const level = success ? 'debug' : 'warn';

    this.logger[level](
      `External API: ${service} - ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms`,
      {
        metric: 'external_api_call',
        service,
        endpoint,
        duration,
        success,
        statusCode,
      },
    );

    this.addMetric({
      name: 'external_api.duration',
      value: duration,
      timestamp: new Date(),
      tags: {
        service,
        endpoint,
        success: String(success),
        statusCode: statusCode ? String(statusCode) : undefined,
      },
    });
  }

  /**
   * Get metrics summary for specified time range
   */
  getMetricsSummary(hours: number = 1): MetricsSummary {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= since);

    return {
      timeRange: `Last ${hours} hour(s)`,
      cache: this.calculateCacheMetrics(recentMetrics),
      api: this.calculateApiMetrics(recentMetrics),
      database: this.calculateDatabaseMetrics(recentMetrics),
      collections: this.calculateCollectionMetrics(recentMetrics),
      externalApis: this.calculateExternalApiMetrics(recentMetrics),
    };
  }

  /**
   * Get detailed metrics by name
   */
  getMetricsByName(name: string, hours: number = 1): Metric[] {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(
      (m) => m.name === name && m.timestamp >= since,
    );
  }

  /**
   * Get metrics by tag
   */
  getMetricsByTag(
    tagKey: string,
    tagValue: string,
    hours: number = 1,
  ): Metric[] {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(
      (m) =>
        m.timestamp >= since &&
        m.tags &&
        m.tags[tagKey] === tagValue,
    );
  }

  /**
   * Get current metrics count
   */
  getMetricsCount(): { total: number; oldest: Date; newest: Date } {
    if (this.metrics.length === 0) {
      return { total: 0, oldest: new Date(), newest: new Date() };
    }

    return {
      total: this.metrics.length,
      oldest: this.metrics[0].timestamp,
      newest: this.metrics[this.metrics.length - 1].timestamp,
    };
  }

  // Private helper methods

  private addMetric(metric: Metric) {
    this.metrics.push(metric);

    // Prevent memory leak - keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  private calculateCacheMetrics(metrics: Metric[]) {
    const cacheMetrics = metrics.filter((m) => m.name === 'cache.access');
    const hits = cacheMetrics.filter((m) => m.value === 1).length;
    const misses = cacheMetrics.filter((m) => m.value === 0).length;
    const total = cacheMetrics.length;
    const hitRate =
      total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';

    return { hits, misses, total, hitRate: `${hitRate}%` };
  }

  private calculateApiMetrics(metrics: Metric[]) {
    const apiMetrics = metrics.filter((m) => m.name === 'api.response_time');
    const totalRequests = apiMetrics.length;

    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: '0ms',
        p95ResponseTime: '0ms',
        p99ResponseTime: '0ms',
      };
    }

    const durations = apiMetrics.map((m) => m.value).sort((a, b) => a - b);
    const sum = durations.reduce((acc, val) => acc + val, 0);
    const avg = sum / totalRequests;
    const p95Index = Math.floor(totalRequests * 0.95);
    const p99Index = Math.floor(totalRequests * 0.99);

    return {
      totalRequests,
      avgResponseTime: `${avg.toFixed(2)}ms`,
      p95ResponseTime: `${durations[p95Index]?.toFixed(2) || 0}ms`,
      p99ResponseTime: `${durations[p99Index]?.toFixed(2) || 0}ms`,
    };
  }

  private calculateDatabaseMetrics(metrics: Metric[]) {
    const dbMetrics = metrics.filter((m) => m.name === 'db.query_time');
    const totalQueries = dbMetrics.length;

    if (totalQueries === 0) {
      return {
        totalQueries: 0,
        avgQueryTime: '0ms',
        slowQueries: 0,
      };
    }

    const durations = dbMetrics.map((m) => m.value);
    const sum = durations.reduce((acc, val) => acc + val, 0);
    const avg = sum / totalQueries;
    const slowQueries = dbMetrics.filter(
      (m) => m.tags?.slow === 'true',
    ).length;

    return {
      totalQueries,
      avgQueryTime: `${avg.toFixed(2)}ms`,
      slowQueries,
    };
  }

  private calculateCollectionMetrics(metrics: Metric[]) {
    const collectionMetrics = metrics.filter(
      (m) => m.name === 'collection.duration',
    );
    const totalJobs = collectionMetrics.length;

    if (totalJobs === 0) {
      return {
        totalJobs: 0,
        successRate: '0.00%',
        avgDuration: '0ms',
        failedJobs: 0,
      };
    }

    const successJobs = collectionMetrics.filter(
      (m) => m.tags?.success === 'true',
    ).length;
    const failedJobs = totalJobs - successJobs;
    const successRate = ((successJobs / totalJobs) * 100).toFixed(2);
    const durations = collectionMetrics.map((m) => m.value);
    const avgDuration =
      durations.reduce((acc, val) => acc + val, 0) / totalJobs;

    return {
      totalJobs,
      successRate: `${successRate}%`,
      avgDuration: `${avgDuration.toFixed(2)}ms`,
      failedJobs,
    };
  }

  private calculateExternalApiMetrics(metrics: Metric[]) {
    const apiMetrics = metrics.filter(
      (m) => m.name === 'external_api.duration',
    );
    const totalCalls = apiMetrics.length;

    if (totalCalls === 0) {
      return {
        totalCalls: 0,
        successRate: '0.00%',
        avgDuration: '0ms',
      };
    }

    const successCalls = apiMetrics.filter(
      (m) => m.tags?.success === 'true',
    ).length;
    const successRate = ((successCalls / totalCalls) * 100).toFixed(2);
    const durations = apiMetrics.map((m) => m.value);
    const avgDuration =
      durations.reduce((acc, val) => acc + val, 0) / totalCalls;

    return {
      totalCalls,
      successRate: `${successRate}%`,
      avgDuration: `${avgDuration.toFixed(2)}ms`,
    };
  }

  private cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // Keep 24 hours
    const beforeCount = this.metrics.length;
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);
    const removed = beforeCount - this.metrics.length;

    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} old metrics`, {
        beforeCount,
        afterCount: this.metrics.length,
      });
    }
  }
}
