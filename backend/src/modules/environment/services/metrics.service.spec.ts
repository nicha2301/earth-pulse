import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    
    // Clear metrics before each test
    service['metrics'] = [];
  });

  describe('trackResponseTime', () => {
    it('should track API response time', () => {
      service.trackResponseTime('/api/test', 150, 200);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('api.response_time');
      expect(metrics[0].value).toBe(150);
      expect(metrics[0].tags).toEqual({
        endpoint: '/api/test',
        statusCode: '200',
      });
    });

    it('should track multiple API calls', () => {
      service.trackResponseTime('/api/test1', 100, 200);
      service.trackResponseTime('/api/test2', 200, 201);
      service.trackResponseTime('/api/test3', 150, 500);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(3);
      expect(metrics.every(m => m.name === 'api.response_time')).toBe(true);
    });
  });

  describe('trackCacheAccess', () => {
    it('should track cache hit', () => {
      service.trackCacheAccess('test-key', true);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('cache.access');
      expect(metrics[0].value).toBe(1);
      expect(metrics[0].tags).toEqual({
        key: 'test-key',
        type: 'hit',
      });
    });

    it('should track cache miss', () => {
      service.trackCacheAccess('test-key', false);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('cache.access');
      expect(metrics[0].value).toBe(0);
      expect(metrics[0].tags).toEqual({
        key: 'test-key',
        type: 'miss',
      });
    });

    it('should track multiple cache accesses', () => {
      service.trackCacheAccess('key1', true);
      service.trackCacheAccess('key2', false);
      service.trackCacheAccess('key3', true);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(3);
      
      const hits = metrics.filter(m => m.value === 1);
      const misses = metrics.filter(m => m.value === 0);
      expect(hits).toHaveLength(2);
      expect(misses).toHaveLength(1);
    });
  });

  describe('trackDatabaseQuery', () => {
    it('should track fast database query', () => {
      service.trackDatabaseQuery('air_quality', 'find', 50, 100);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('db.query_time');
      expect(metrics[0].value).toBe(50);
      expect(metrics[0].tags?.slow).toBe('false');
      expect(metrics[0].tags?.collection).toBe('air_quality');
      expect(metrics[0].tags?.operation).toBe('find');
      expect(metrics[0].tags?.recordCount).toBe('100');
    });

    it('should track slow database query', () => {
      service.trackDatabaseQuery('temperature', 'aggregate', 150, 5000);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags?.slow).toBe('true');
      expect(metrics[0].value).toBe(150);
    });

    it('should work without recordCount', () => {
      service.trackDatabaseQuery('test', 'find', 30);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags?.recordCount).toBeUndefined();
    });
  });

  describe('trackCollectionJob', () => {
    it('should track successful collection job', () => {
      service.trackCollectionJob('airQuality', 5000, true, 100);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('collection.duration');
      expect(metrics[0].value).toBe(5000);
      expect(metrics[0].tags).toEqual({
        source: 'airQuality',
        success: 'true',
        recordsCollected: '100',
      });
    });

    it('should track failed collection job', () => {
      service.trackCollectionJob('temperature', 1000, false, 0, 'API Error');

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags?.success).toBe('false');
      expect(metrics[0].tags?.recordsCollected).toBe('0');
    });
  });

  describe('trackExternalApiCall', () => {
    it('should track successful external API call', () => {
      service.trackExternalApiCall('aqicn', '/feed/beijing', 200, true, 200);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('external_api.duration');
      expect(metrics[0].value).toBe(200);
      expect(metrics[0].tags).toEqual({
        service: 'aqicn',
        endpoint: '/feed/beijing',
        success: 'true',
        statusCode: '200',
      });
    });

    it('should track failed external API call', () => {
      service.trackExternalApiCall('openweather', '/weather', 500, false, 500);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags?.success).toBe('false');
      expect(metrics[0].tags?.statusCode).toBe('500');
    });

    it('should work without status code', () => {
      service.trackExternalApiCall('firms', '/fires', 300, true);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags?.statusCode).toBeUndefined();
    });
  });

  describe('getMetricsSummary', () => {
    beforeEach(() => {
      // Add sample metrics
      service.trackResponseTime('/api/test', 100, 200);
      service.trackResponseTime('/api/test', 200, 200);
      service.trackCacheAccess('key1', true);
      service.trackCacheAccess('key2', false);
      service.trackDatabaseQuery('test', 'find', 50, 100);
      service.trackCollectionJob('test', 1000, true, 50);
      service.trackExternalApiCall('test', '/test', 150, true, 200);
    });

    it('should generate metrics summary', () => {
      const summary = service.getMetricsSummary(1);

      expect(summary).toBeDefined();
      expect(summary.timeRange).toBe('Last 1 hour(s)');
      expect(summary.cache).toBeDefined();
      expect(summary.api).toBeDefined();
      expect(summary.database).toBeDefined();
      expect(summary.collections).toBeDefined();
      expect(summary.externalApis).toBeDefined();
    });

    it('should calculate cache metrics correctly', () => {
      const summary = service.getMetricsSummary(1);

      expect(summary.cache.hits).toBe(1);
      expect(summary.cache.misses).toBe(1);
      expect(summary.cache.total).toBe(2);
      expect(summary.cache.hitRate).toBe('50.00%');
    });

    it('should calculate API metrics correctly', () => {
      const summary = service.getMetricsSummary(1);

      expect(summary.api.totalRequests).toBe(2);
      expect(summary.api.avgResponseTime).toBe('150.00ms');
    });

    it('should return empty summary when no metrics', () => {
      service['metrics'] = [];
      const summary = service.getMetricsSummary(1);

      expect(summary.cache.total).toBe(0);
      expect(summary.api.totalRequests).toBe(0);
      expect(summary.database.totalQueries).toBe(0);
    });
  });

  describe('getMetricsByName', () => {
    beforeEach(() => {
      service.trackResponseTime('/api/test1', 100, 200);
      service.trackResponseTime('/api/test2', 200, 200);
      service.trackCacheAccess('key1', true);
      service.trackDatabaseQuery('test', 'find', 50);
    });

    it('should filter metrics by name', () => {
      const apiMetrics = service.getMetricsByName('api.response_time', 1);
      const cacheMetrics = service.getMetricsByName('cache.access', 1);

      expect(apiMetrics).toHaveLength(2);
      expect(cacheMetrics).toHaveLength(1);
      expect(apiMetrics.every(m => m.name === 'api.response_time')).toBe(true);
    });

    it('should return empty array for non-existent metric', () => {
      const metrics = service.getMetricsByName('non.existent', 1);
      expect(metrics).toHaveLength(0);
    });

    it('should respect time range', () => {
      // Add old metric (more than 1 hour ago)
      const oldMetric = {
        name: 'api.response_time',
        value: 100,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        tags: { endpoint: '/old', statusCode: '200' },
      };
      service['metrics'].push(oldMetric);

      const recentMetrics = service.getMetricsByName('api.response_time', 1);
      expect(recentMetrics).toHaveLength(2); // Should not include old metric
    });
  });

  describe('getMetricsByTag', () => {
    beforeEach(() => {
      service.trackResponseTime('/api/test', 100, 200);
      service.trackResponseTime('/api/test', 150, 500);
      service.trackCacheAccess('key1', true);
    });

    it('should filter metrics by tag', () => {
      const successMetrics = service.getMetricsByTag('statusCode', '200', 1);
      const errorMetrics = service.getMetricsByTag('statusCode', '500', 1);

      expect(successMetrics).toHaveLength(1);
      expect(errorMetrics).toHaveLength(1);
    });

    it('should return empty array when tag not found', () => {
      const metrics = service.getMetricsByTag('nonexistent', 'value', 1);
      expect(metrics).toHaveLength(0);
    });

    it('should handle metrics without tags', () => {
      service['metrics'].push({
        name: 'test',
        value: 100,
        timestamp: new Date(),
        // No tags
      });

      const metrics = service.getMetricsByTag('someTag', 'value', 1);
      expect(metrics).toHaveLength(0);
    });
  });

  describe('cleanupOldMetrics', () => {
    it('should limit metrics to MAX_METRICS', () => {
      const MAX_METRICS = service['MAX_METRICS'];
      
      // Add more than MAX_METRICS
      for (let i = 0; i < MAX_METRICS + 100; i++) {
        service.trackResponseTime('/api/test', 100, 200);
      }

      service['cleanupOldMetrics']();

      expect(service['metrics'].length).toBeLessThanOrEqual(MAX_METRICS);
    });

    it('should keep newest metrics when cleaning up', () => {
      const MAX_METRICS = service['MAX_METRICS'];
      
      // Add metrics with specific value to identify
      for (let i = 0; i < MAX_METRICS + 10; i++) {
        service.trackResponseTime('/api/test', i, 200);
      }

      service['cleanupOldMetrics']();

      const remainingMetrics = service['metrics'];
      const firstMetricValue = remainingMetrics[0].value;
      
      // Should keep newer metrics (higher values)
      expect(firstMetricValue).toBeGreaterThan(5);
    });
  });

  describe('Integration', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should track multiple metric types', () => {
      service.trackResponseTime('/api/test', 100, 200);
      service.trackCacheAccess('key', true);
      service.trackDatabaseQuery('collection', 'find', 50);
      service.trackCollectionJob('source', 1000, true, 100);
      service.trackExternalApiCall('service', '/endpoint', 200, true);

      const metrics = service['metrics'];
      expect(metrics).toHaveLength(5);
      
      const metricTypes = new Set(metrics.map(m => m.name));
      expect(metricTypes.size).toBe(5); // 5 different metric types
    });
  });
});
