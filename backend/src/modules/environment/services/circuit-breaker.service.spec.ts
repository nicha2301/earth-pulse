import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should log initialization message', () => {
      // Service logs on construction, just verify it exists
      expect(service).toBeInstanceOf(CircuitBreakerService);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should create circuit breaker for new service', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      const breaker = service.getCircuitBreaker('test-service', mockAction);
      
      expect(breaker).toBeDefined();
      expect(breaker.name).toContain('test-service');
    });

    it('should return existing circuit breaker for same service', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      const breaker1 = service.getCircuitBreaker('test-service', mockAction);
      const breaker2 = service.getCircuitBreaker('test-service', mockAction);
      
      expect(breaker1).toBe(breaker2);
    });

    it('should set fallback if provided', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const mockFallback = jest.fn().mockResolvedValue('fallback');
      
      const breaker = service.getCircuitBreaker('test-service', mockAction, mockFallback);
      
      expect(breaker).toBeDefined();
    });

    it('should use service-specific config for known services', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      const breaker = service.getCircuitBreaker('aqicn', mockAction);
      
      expect(breaker).toBeDefined();
      expect(breaker.name).toContain('AQICN');
    });
  });

  describe('execute', () => {
    it('should execute action successfully', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      const result = await service.execute('test-service', mockAction, []);
      
      expect(result).toBe('success');
      expect(mockAction).toHaveBeenCalled();
    });

    it('should execute action with arguments', async () => {
      const mockAction = jest.fn((a: number, b: number) => Promise.resolve(a + b));
      
      const result = await service.execute('test-service', mockAction, [5, 3]);
      
      expect(result).toBe(8);
      expect(mockAction).toHaveBeenCalledWith(5, 3);
    });

    it('should throw error when action fails', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Action failed'));
      
      await expect(
        service.execute('test-service', mockAction, [])
      ).rejects.toThrow('Action failed');
    });

    it('should use fallback when action fails and fallback provided', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Action failed'));
      const mockFallback = jest.fn().mockResolvedValue('fallback result');
      
      const result = await service.execute('test-service', mockAction, [], mockFallback);
      
      expect(result).toBe('fallback result');
    });

    it('should reuse circuit breaker for same service', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      await service.execute('test-service', mockAction, []);
      await service.execute('test-service', mockAction, []);
      
      expect(mockAction).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('should return null for non-existent service', () => {
      const stats = service.getStats('non-existent-service');
      
      expect(stats).toBeNull();
    });

    it('should return stats for existing circuit breaker', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      await service.execute('test-service', mockAction, []);
      
      const stats = service.getStats('test-service');
      
      expect(stats).toBeDefined();
      expect(stats?.name).toBe('test-service');
      expect(stats?.state).toBe('closed');
      expect(stats?.stats).toBeDefined();
    });

    it('should track successful requests in stats', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      await service.execute('test-service', mockAction, []);
      await service.execute('test-service', mockAction, []);
      
      const stats = service.getStats('test-service');
      
      expect(stats?.stats.fires).toBe(2);
      expect(stats?.stats.successes).toBe(2);
      expect(stats?.stats.failures).toBe(0);
    });

    it('should track failed requests in stats', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Failed'));
      
      try {
        await service.execute('test-service', mockAction, []);
      } catch (e) {
        // Expected to fail
      }
      
      const stats = service.getStats('test-service');
      
      expect(stats?.stats.fires).toBe(1);
      expect(stats?.stats.failures).toBe(1);
    });
  });

  describe('getAllStats', () => {
    it('should return empty object when no circuit breakers exist', () => {
      const stats = service.getAllStats();
      
      expect(stats).toEqual({});
    });

    it('should return stats for all circuit breakers', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      await service.execute('service1', mockAction, []);
      await service.execute('service2', mockAction, []);
      
      const stats = service.getAllStats();
      
      expect(Object.keys(stats)).toHaveLength(2);
      expect(stats['service1'].name).toBe('service1');
      expect(stats['service2'].name).toBe('service2');
    });

    it('should include state information for all breakers', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      await service.execute('test-service', mockAction, []);
      
      const stats = service.getAllStats();
      
      expect(stats['test-service'].state).toBe('closed');
    });
  });

  describe('shutdownAll', () => {
    it('should shutdown all circuit breakers', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      await service.execute('service1', mockAction, []);
      await service.execute('service2', mockAction, []);
      
      service.shutdownAll();
      
      const stats = service.getAllStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });

    it('should allow creating new breakers after shutdown', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      await service.execute('test-service', mockAction, []);
      service.shutdownAll();
      
      await service.execute('test-service', mockAction, []);
      const stats = service.getStats('test-service');
      
      expect(stats).toBeDefined();
    });
  });

  describe('Circuit Breaker States', () => {
    it('should start in closed state', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      
      await service.execute('test-service', mockAction, []);
      const stats = service.getStats('test-service');
      
      expect(stats?.state).toBe('closed');
    });

    it('should handle timeout errors', async () => {
      const mockAction = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('too-late'), 20000);
        });
      });
      
      try {
        await service.execute('test-service', mockAction, []);
      } catch (e) {
        // Expected timeout
      }
      
      const stats = service.getStats('test-service');
      expect(stats).toBeDefined();
    });

    it('should track multiple requests correctly', async () => {
      const mockAction = jest.fn()
        .mockResolvedValueOnce('success1')
        .mockResolvedValueOnce('success2')
        .mockRejectedValueOnce(new Error('fail'));
      
      await service.execute('test-service', mockAction, []);
      await service.execute('test-service', mockAction, []);
      
      try {
        await service.execute('test-service', mockAction, []);
      } catch (e) {
        // Expected
      }
      
      const stats = service.getStats('test-service');
      expect(stats?.stats.fires).toBe(3);
      expect(stats?.stats.successes).toBe(2);
      expect(stats?.stats.failures).toBe(1);
    });
  });

  describe('Service-Specific Configurations', () => {
    it('should use AQICN config for aqicn service', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const breaker = service.getCircuitBreaker('aqicn', mockAction);
      
      expect(breaker.name).toContain('AQICN');
    });

    it('should use OpenWeather config for openweather service', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const breaker = service.getCircuitBreaker('openweather', mockAction);
      
      expect(breaker.name).toContain('OpenWeather');
    });

    it('should use FIRMS config for firms service', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const breaker = service.getCircuitBreaker('firms', mockAction);
      
      expect(breaker.name).toContain('FIRMS');
    });

    it('should use NOAA config for noaa service', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const breaker = service.getCircuitBreaker('noaa', mockAction);
      
      expect(breaker.name).toContain('NOAA');
    });

    it('should use NSIDC config for nsidc service', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const breaker = service.getCircuitBreaker('nsidc', mockAction);
      
      expect(breaker.name).toContain('NSIDC');
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors when no fallback', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('API Error'));
      
      await expect(
        service.execute('test-service', mockAction, [])
      ).rejects.toThrow('API Error');
    });

    it('should handle multiple consecutive failures', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Failed'));
      
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('test-service', mockAction, []);
        } catch (e) {
          // Expected
        }
      }
      
      const stats = service.getStats('test-service');
      expect(stats?.stats.failures).toBe(3);
    });

    it('should recover after failures when requests succeed', async () => {
      const mockAction = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('Success');
      
      try {
        await service.execute('test-service', mockAction, []);
      } catch (e) {
        // Expected
      }
      
      const result = await service.execute('test-service', mockAction, []);
      expect(result).toBe('Success');
      
      const stats = service.getStats('test-service');
      expect(stats?.stats.successes).toBe(1);
      expect(stats?.stats.failures).toBe(1);
    });
  });
});
