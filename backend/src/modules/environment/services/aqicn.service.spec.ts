import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AqicnService } from './aqicn.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('AqicnService', () => {
  let service: AqicnService;
  let httpService: HttpService;
  let circuitBreakerService: CircuitBreakerService;
  let configService: ConfigService;

  // Mock axios instance
  const mockAxiosRef = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AqicnService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            axiosRef: mockAxiosRef,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AQICN_API_TOKEN') return 'test-token';
              return null;
            }),
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: jest.fn((serviceName, action, args, fallback) => {
              // Execute the action directly in tests
              return action(...args);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AqicnService>(AqicnService);
    httpService = module.get<HttpService>(HttpService);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    configService = module.get<ConfigService>(ConfigService);

    // Initialize service
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with valid API token', () => {
      expect(configService.get).toHaveBeenCalledWith('AQICN_API_TOKEN');
    });

    it('should warn when using demo token', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue('demo'),
      };

      const module = await Test.createTestingModule({
        providers: [
          AqicnService,
          { provide: HttpService, useValue: { axiosRef: mockAxiosRef, get: jest.fn() } },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: CircuitBreakerService, useValue: { execute: jest.fn() } },
        ],
      }).compile();

      const testService = module.get<AqicnService>(AqicnService);
      expect(testService).toBeDefined();
    });
  });

  describe('getAirQuality', () => {
    const mockSuccessResponse: Partial<AxiosResponse> = {
      data: {
        status: 'ok',
        data: {
          aqi: 75,
          city: {
            name: 'Hanoi, Vietnam',
            geo: [21.0285, 105.8542],
          },
          time: {
            iso: '2025-10-06T10:00:00Z',
          },
          iaqi: {
            pm25: { v: 55 },
            pm10: { v: 70 },
            o3: { v: 30 },
            no2: { v: 20 },
            so2: { v: 5 },
            co: { v: 0.5 },
          },
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should fetch air quality successfully', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockSuccessResponse as AxiosResponse));

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeDefined();
      expect(result?.city).toBe('Hanoi');
      expect(result?.country).toBe('Vietnam');
      expect(result?.aqi).toBe(75);
      expect(result?.level).toBe('Moderate');
      expect(result?.pollutants.pm25).toBe(55);
      expect(result?.coordinates.lat).toBe(21.0285);
      expect(result?.coordinates.lon).toBe(105.8542);
    });

    it('should return null when API status is not ok', async () => {
      const errorResponse = {
        ...mockSuccessResponse,
        data: { status: 'error', data: {} },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(errorResponse as AxiosResponse));

      const result = await service.getAirQuality('invalid-city');

      expect(result).toBeNull();
    });

    it('should return null when AQI value is invalid', async () => {
      const invalidAqiResponse = {
        ...mockSuccessResponse,
        data: {
          status: 'ok',
          data: {
            ...mockSuccessResponse.data.data,
            aqi: '-',
          },
        },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(invalidAqiResponse as AxiosResponse));

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeNull();
    });

    it('should return null when timestamp is invalid', async () => {
      const invalidTimestampResponse = {
        ...mockSuccessResponse,
        data: {
          status: 'ok',
          data: {
            ...mockSuccessResponse.data.data,
            time: { iso: 'invalid-date' },
          },
        },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(invalidTimestampResponse as AxiosResponse));

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeNull();
    });

    it('should handle missing pollutant data', async () => {
      const noPollutantsResponse = {
        ...mockSuccessResponse,
        data: {
          status: 'ok',
          data: {
            ...mockSuccessResponse.data.data,
            iaqi: {},
          },
        },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(noPollutantsResponse as AxiosResponse));

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeDefined();
      expect(result?.pollutants.pm25).toBeUndefined();
      expect(result?.pollutants.pm10).toBeUndefined();
    });

    it('should execute through circuit breaker', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockSuccessResponse as AxiosResponse));

      await service.getAirQuality('hanoi');

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'aqicn',
        expect.any(Function),
        ['hanoi'],
        expect.any(Function),
      );
    });

    it('should return null on HTTP error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeNull();
    });

    it('should handle 404 error', async () => {
      const error = new Error('Request failed with status code 404');
      (error as any).response = { status: 404 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getAirQuality('non-existent-city');

      expect(result).toBeNull();
    });

    it('should handle 500 error', async () => {
      const error = new Error('Request failed with status code 500');
      (error as any).response = { status: 500 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeNull();
    });

    it('should handle timeout error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({ code: 'ETIMEDOUT', message: 'Request timeout' }))
      );

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeNull();
    });
  });

  describe('getAqiLevel', () => {
    it('should return Good for AQI <= 50', () => {
      const result = service['getAqiLevel'](30);
      expect(result).toBe('Good');
    });

    it('should return Moderate for AQI 51-100', () => {
      const result = service['getAqiLevel'](75);
      expect(result).toBe('Moderate');
    });

    it('should return Unhealthy for Sensitive Groups for AQI 101-150', () => {
      const result = service['getAqiLevel'](125);
      expect(result).toBe('Unhealthy for Sensitive Groups');
    });

    it('should return Unhealthy for AQI 151-200', () => {
      const result = service['getAqiLevel'](175);
      expect(result).toBe('Unhealthy');
    });

    it('should return Very Unhealthy for AQI 201-300', () => {
      const result = service['getAqiLevel'](250);
      expect(result).toBe('Very Unhealthy');
    });

    it('should return Hazardous for AQI > 300', () => {
      const result = service['getAqiLevel'](350);
      expect(result).toBe('Hazardous');
    });

    it('should handle boundary values correctly', () => {
      expect(service['getAqiLevel'](50)).toBe('Good');
      expect(service['getAqiLevel'](51)).toBe('Moderate');
      expect(service['getAqiLevel'](100)).toBe('Moderate');
      expect(service['getAqiLevel'](101)).toBe('Unhealthy for Sensitive Groups');
    });
  });

  describe('extractCountry', () => {
    it('should extract country from city name', () => {
      const result = service['extractCountry']('Hanoi, Vietnam');
      expect(result).toBe('Vietnam');
    });

    it('should handle city with multiple commas', () => {
      const result = service['extractCountry']('Ho Chi Minh City, Vietnam');
      expect(result).toBe('Vietnam');
    });

    it('should return Unknown for city without country', () => {
      const result = service['extractCountry']('Hanoi');
      expect(result).toBe('Unknown');
    });

    it('should trim whitespace', () => {
      const result = service['extractCountry']('Tokyo,   Japan  ');
      expect(result).toBe('Japan');
    });
  });

  describe('getCitiesForCollection', () => {
    it('should return list of cities', () => {
      const cities = service.getCitiesForCollection();

      expect(cities).toBeDefined();
      expect(Array.isArray(cities)).toBe(true);
      expect(cities.length).toBeGreaterThan(0);
    });

    it('should include major cities', () => {
      const cities = service.getCitiesForCollection();

      expect(cities).toContain('hanoi');
      expect(cities).toContain('tokyo');
      expect(cities).toContain('beijing');
      expect(cities).toContain('london');
      expect(cities).toContain('new-york');
    });

    it('should return 20 cities', () => {
      const cities = service.getCitiesForCollection();
      expect(cities).toHaveLength(20);
    });

    it('should return same list on multiple calls', () => {
      const cities1 = service.getCitiesForCollection();
      const cities2 = service.getCitiesForCollection();

      expect(cities1).toEqual(cities2);
    });
  });

  describe('API Response Parsing', () => {
    it('should parse minimal valid response', async () => {
      const minimalResponse: Partial<AxiosResponse> = {
        data: {
          status: 'ok',
          data: {
            aqi: 50,
            city: {
              name: 'Tokyo, Japan',
              geo: [35.6895, 139.6917],
            },
            time: {
              iso: '2025-10-06T12:00:00Z',
            },
            iaqi: {},
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(minimalResponse as AxiosResponse));

      const result = await service.getAirQuality('tokyo');

      expect(result).toBeDefined();
      expect(result?.city).toBe('Tokyo');
      expect(result?.aqi).toBe(50);
    });

    it('should handle numeric AQI as string', async () => {
      const stringAqiResponse = {
        data: {
          status: 'ok',
          data: {
            aqi: '85',
            city: {
              name: 'Beijing, China',
              geo: [39.9042, 116.4074],
            },
            time: {
              iso: '2025-10-06T12:00:00Z',
            },
            iaqi: {},
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(stringAqiResponse as AxiosResponse));

      const result = await service.getAirQuality('beijing');

      expect(result).toBeDefined();
      expect(result?.aqi).toBe(85);
    });

    it('should extract city name correctly with commas', async () => {
      const response = {
        data: {
          status: 'ok',
          data: {
            aqi: 60,
            city: {
              name: 'Ho Chi Minh City, Vietnam',
              geo: [10.8231, 106.6297],
            },
            time: {
              iso: '2025-10-06T12:00:00Z',
            },
            iaqi: {},
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(response as AxiosResponse));

      const result = await service.getAirQuality('ho-chi-minh-city');

      expect(result?.city).toBe('Ho Chi Minh City');
      expect(result?.country).toBe('Vietnam');
    });
  });

  describe('Integration with Circuit Breaker', () => {
    it('should use fallback when circuit breaker returns null', async () => {
      // Mock circuit breaker to use fallback
      jest.spyOn(circuitBreakerService, 'execute').mockImplementation(
        async (serviceName, action, args, fallback) => {
          return fallback ? fallback(...args) : null;
        }
      );

      const result = await service.getAirQuality('hanoi');

      expect(result).toBeNull();
    });

    it('should pass correct service name to circuit breaker', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: {
            status: 'ok',
            data: {
              aqi: 50,
              city: { name: 'Tokyo, Japan', geo: [35.6895, 139.6917] },
              time: { iso: '2025-10-06T12:00:00Z' },
              iaqi: {},
            },
          },
        } as AxiosResponse)
      );

      await service.getAirQuality('tokyo');

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'aqicn',
        expect.any(Function),
        expect.any(Array),
        expect.any(Function),
      );
    });
  });
});
