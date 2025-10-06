import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

// Create mock Redis instance with methods
const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

// Mock ioredis module with proper default export
jest.mock('ioredis', () => {
  const mockConstructor = jest.fn().mockImplementation(() => mockRedisInstance);
  return {
    __esModule: true,
    default: mockConstructor,
  };
});

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                CACHE_TTL: 3600,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Initialize the service
    await service.onModuleInit();
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  describe('get', () => {
    it('should return null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await service.get('nonexistent-key');

      expect(result).toBeNull();
      expect(mockRedisInstance.get).toHaveBeenCalledWith('nonexistent-key');
    });

    it('should return parsed object when key exists', async () => {
      const testData = { city: 'Hanoi', aqi: 100 };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(testData));

      const result = await service.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when JSON parsing fails', async () => {
      mockRedisInstance.get.mockResolvedValue('invalid-json');

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Redis connection error'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      const testData = { city: 'Hanoi', aqi: 100 };

      await service.set('test-key', testData, 3600);

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        'EX',
        3600,
      );
    });

    it('should use default TTL when ttl is not provided', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      const testData = { city: 'Hanoi' };

      await service.set('test-key', testData);

      // Should use default TTL (3600) from config
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        'EX',
        3600,
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisInstance.set.mockRejectedValue(new Error('Redis connection error'));
      const testData = { city: 'Hanoi' };

      await expect(service.set('test-key', testData, 3600)).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      await service.del('test-key');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisInstance.del.mockRejectedValue(new Error('Redis connection error'));

      await expect(service.del('test-key')).resolves.not.toThrow();
    });
  });

  describe('keys', () => {
    it('should return matching keys', async () => {
      const mockKeys = ['air_quality:hanoi', 'air_quality:tokyo'];
      mockRedisInstance.keys.mockResolvedValue(mockKeys);

      const result = await service.keys('air_quality:*');

      expect(result).toEqual(mockKeys);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('air_quality:*');
    });

    it('should return empty array on error', async () => {
      mockRedisInstance.keys.mockRejectedValue(new Error('Redis error'));

      const result = await service.keys('test:*');

      expect(result).toEqual([]);
    });
  });

  describe('Health Check', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have Redis client', () => {
      expect(service['redis']).toBeDefined();
    });
  });
});
