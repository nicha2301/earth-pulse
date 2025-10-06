import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigValidationService } from './config-validation.service';

describe('ConfigValidationService', () => {
  let service: ConfigValidationService;
  let mockConfigService: jest.Mocked<ConfigService>;

  // Helper function to create mock ConfigService
  const createMockConfigService = (config: Record<string, any> = {}) => ({
    get: jest.fn((key: string) => config[key]),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('validateConfiguration', () => {
    it('should pass validation with all required configs', async () => {
      mockConfigService = createMockConfigService({
        MONGODB_URI: 'mongodb://localhost:27017/earth-pulse',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        OPENWEATHER_API_KEY: 'valid-api-key-12345',
        FIRMS_MAP_KEY: 'valid-firms-key',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.validateConfiguration();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when required config is missing', async () => {
      mockConfigService = createMockConfigService({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        // Missing MONGODB_URI, OPENWEATHER_API_KEY, FIRMS_MAP_KEY
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.validateConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('MONGODB_URI'))).toBe(true);
      expect(result.errors.some(e => e.includes('OPENWEATHER_API_KEY'))).toBe(true);
      expect(result.errors.some(e => e.includes('FIRMS_MAP_KEY'))).toBe(true);
    });

    it('should fail validation when REDIS_PORT is invalid', async () => {
      mockConfigService = createMockConfigService({
        MONGODB_URI: 'mongodb://localhost:27017/earth-pulse',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 'invalid-port',
        OPENWEATHER_API_KEY: 'valid-api-key-12345',
        FIRMS_MAP_KEY: 'valid-firms-key',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.validateConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('REDIS_PORT'))).toBe(true);
    });

    it('should fail validation when OPENWEATHER_API_KEY is demo', async () => {
      mockConfigService = createMockConfigService({
        MONGODB_URI: 'mongodb://localhost:27017/earth-pulse',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        OPENWEATHER_API_KEY: 'demo',
        FIRMS_MAP_KEY: 'valid-firms-key',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.validateConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('OPENWEATHER_API_KEY'))).toBe(true);
    });

    it('should add warnings for missing optional configs', async () => {
      mockConfigService = createMockConfigService({
        MONGODB_URI: 'mongodb://localhost:27017/earth-pulse',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        OPENWEATHER_API_KEY: 'valid-api-key-12345',
        FIRMS_MAP_KEY: 'valid-firms-key',
        // Missing optional: AQICN_API_TOKEN, PORT, FRONTEND_URL
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.validateConfiguration();

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('AQICN_API_TOKEN'))).toBe(true);
    });

    it('should warn when optional PORT config is invalid', async () => {
      mockConfigService = createMockConfigService({
        MONGODB_URI: 'mongodb://localhost:27017/earth-pulse',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        OPENWEATHER_API_KEY: 'valid-api-key-12345',
        FIRMS_MAP_KEY: 'valid-firms-key',
        PORT: 'invalid-port',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.validateConfiguration();

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('PORT'))).toBe(true);
    });
  });

  describe('getConfigOrDefault', () => {
    it('should return config value when it exists', async () => {
      mockConfigService = createMockConfigService({
        PORT: '4000',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getConfigOrDefault('PORT', '3000');

      expect(result).toBe('4000');
    });

    it('should return default value when config does not exist', async () => {
      mockConfigService = createMockConfigService({}) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getConfigOrDefault('PORT', '3000');

      expect(result).toBe('3000');
    });

    it('should return default value when config is null', async () => {
      mockConfigService = createMockConfigService({
        PORT: null,
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getConfigOrDefault('PORT', '3000');

      expect(result).toBe('3000');
    });

    it('should work with different types', async () => {
      mockConfigService = createMockConfigService({
        CACHE_TTL: 7200,
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getConfigOrDefault<number>('CACHE_TTL', 3600);

      expect(result).toBe(7200);
      expect(typeof result).toBe('number');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature flag is "true"', async () => {
      mockConfigService = createMockConfigService({
        OPENWEATHER_ONE_CALL_ENABLED: 'true',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.isFeatureEnabled('OPENWEATHER_ONE_CALL_ENABLED');

      expect(result).toBe(true);
    });

    it('should return false when feature flag is not "true"', async () => {
      mockConfigService = createMockConfigService({
        OPENWEATHER_ONE_CALL_ENABLED: 'false',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.isFeatureEnabled('OPENWEATHER_ONE_CALL_ENABLED');

      expect(result).toBe(false);
    });

    it('should return false when feature flag is undefined', async () => {
      mockConfigService = createMockConfigService({}) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.isFeatureEnabled('SOME_FEATURE');

      expect(result).toBe(false);
    });
  });

  describe('getNumericConfig', () => {
    it('should return parsed numeric value when valid', async () => {
      mockConfigService = createMockConfigService({
        RETRY_MAX_ATTEMPTS: '5',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getNumericConfig('RETRY_MAX_ATTEMPTS', 3);

      expect(result).toBe(5);
    });

    it('should return default when config is missing', async () => {
      mockConfigService = createMockConfigService({}) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getNumericConfig('RETRY_MAX_ATTEMPTS', 3);

      expect(result).toBe(3);
    });

    it('should return default when config is not a number', async () => {
      mockConfigService = createMockConfigService({
        RETRY_MAX_ATTEMPTS: 'invalid',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getNumericConfig('RETRY_MAX_ATTEMPTS', 3);

      expect(result).toBe(3);
    });

    it('should enforce minimum value', async () => {
      mockConfigService = createMockConfigService({
        RETRY_MAX_ATTEMPTS: '1',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getNumericConfig('RETRY_MAX_ATTEMPTS', 3, 2, 10);

      expect(result).toBe(2); // Should return min value
    });

    it('should enforce maximum value', async () => {
      mockConfigService = createMockConfigService({
        RETRY_MAX_ATTEMPTS: '15',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getNumericConfig('RETRY_MAX_ATTEMPTS', 3, 2, 10);

      expect(result).toBe(10); // Should return max value
    });

    it('should allow value within min-max range', async () => {
      mockConfigService = createMockConfigService({
        RETRY_MAX_ATTEMPTS: '5',
      }) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      const result = service.getNumericConfig('RETRY_MAX_ATTEMPTS', 3, 2, 10);

      expect(result).toBe(5);
    });
  });

  describe('onModuleInit', () => {
    it('should not exit process when validation passes', async () => {
      mockConfigService = createMockConfigService({
        MONGODB_URI: 'mongodb://localhost:27017/earth-pulse',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        OPENWEATHER_API_KEY: 'valid-api-key-12345',
        FIRMS_MAP_KEY: 'valid-firms-key',
        NODE_ENV: 'production',
      }) as any;

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      
      // Should not throw
      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('should exit process in production when validation fails', async () => {
      // Set NODE_ENV via process.env (service checks process.env directly)
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockConfigService = createMockConfigService({
        REDIS_HOST: 'localhost',
        // Missing required configs
      }) as any;

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as any);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      
      // Should throw because process.exit is called
      await expect(service.onModuleInit()).rejects.toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should not exit process in test mode when validation fails', async () => {
      mockConfigService = createMockConfigService({
        REDIS_HOST: 'localhost',
        NODE_ENV: 'test',
        // Missing required configs
      }) as any;

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);
      
      // Should not throw in test mode
      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });

  describe('Integration', () => {
    it('should be defined', async () => {
      mockConfigService = createMockConfigService({}) as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigValidationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<ConfigValidationService>(ConfigValidationService);

      expect(service).toBeDefined();
    });
  });
});
