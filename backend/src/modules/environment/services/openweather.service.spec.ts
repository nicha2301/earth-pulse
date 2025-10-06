import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { OpenWeatherService } from './openweather.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('OpenWeatherService', () => {
  let service: OpenWeatherService;
  let httpService: HttpService;
  let circuitBreakerService: CircuitBreakerService;
  let configService: ConfigService;

  const mockAxiosRef = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenWeatherService,
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
              if (key === 'OPENWEATHER_API_KEY') return 'test-api-key';
              if (key === 'OPENWEATHER_ONE_CALL_ENABLED') return 'false';
              return null;
            }),
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: jest.fn((serviceName, action, args, fallback) => {
              return action(...args);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OpenWeatherService>(OpenWeatherService);
    httpService = module.get<HttpService>(HttpService);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    configService = module.get<ConfigService>(ConfigService);

    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with valid API key', () => {
      expect(configService.get).toHaveBeenCalledWith('OPENWEATHER_API_KEY');
    });

    it('should throw error when API key is missing', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(null),
      };

      expect(() => {
        new OpenWeatherService(
          httpService,
          mockConfigService as any,
          circuitBreakerService,
        );
      }).toThrow('OPENWEATHER_API_KEY is required');
    });

    it('should throw error when API key is demo', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue('demo'),
      };

      expect(() => {
        new OpenWeatherService(
          httpService,
          mockConfigService as any,
          circuitBreakerService,
        );
      }).toThrow('OPENWEATHER_API_KEY is required');
    });
  });

  describe('getTemperature', () => {
    const mockSuccessResponse: Partial<AxiosResponse> = {
      data: {
        name: 'Hanoi',
        sys: { country: 'VN' },
        main: {
          temp: 28.5,
          feels_like: 30.2,
          temp_min: 27.0,
          temp_max: 30.0,
          humidity: 65,
          pressure: 1013,
        },
        weather: [
          {
            description: 'clear sky',
          },
        ],
        coord: {
          lat: 21.0285,
          lon: 105.8542,
        },
        dt: 1696608000, // Unix timestamp
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should fetch temperature data successfully', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockSuccessResponse as AxiosResponse));

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result).toBeDefined();
      expect(result?.location).toBe('Hanoi');
      expect(result?.country).toBe('VN');
      expect(result?.temperature).toBe(28.5);
      expect(result?.feelsLike).toBe(30.2);
      expect(result?.tempMin).toBe(27.0);
      expect(result?.tempMax).toBe(30.0);
      expect(result?.humidity).toBe(65);
      expect(result?.pressure).toBe(1013);
      expect(result?.weatherDescription).toBe('clear sky');
      expect(result?.coordinates.lat).toBe(21.0285);
      expect(result?.coordinates.lon).toBe(105.8542);
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it('should handle missing weather description', async () => {
      const responseNoWeather = {
        ...mockSuccessResponse,
        data: {
          ...mockSuccessResponse.data,
          weather: [],
        },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(responseNoWeather as AxiosResponse));

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result?.weatherDescription).toBe('');
    });

    it('should execute through circuit breaker', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockSuccessResponse as AxiosResponse));

      await service.getTemperature(21.0285, 105.8542);

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'openweather',
        expect.any(Function),
        [21.0285, 105.8542],
        expect.any(Function),
      );
    });

    it('should return null on HTTP error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result).toBeNull();
    });

    it('should handle 404 error', async () => {
      const error = new Error('Request failed with status code 404');
      (error as any).response = { status: 404 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getTemperature(999, 999);

      expect(result).toBeNull();
    });

    it('should handle 401 unauthorized error', async () => {
      const error = new Error('Request failed with status code 401');
      (error as any).response = { status: 401 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result).toBeNull();
    });

    it('should handle 500 server error', async () => {
      const error = new Error('Request failed with status code 500');
      (error as any).response = { status: 500 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result).toBeNull();
    });

    it('should handle timeout error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({ code: 'ETIMEDOUT', message: 'Request timeout' }))
      );

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result).toBeNull();
    });

    it('should convert Unix timestamp to Date correctly', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockSuccessResponse as AxiosResponse));

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result?.timestamp).toBeInstanceOf(Date);
      expect(result?.timestamp.getTime()).toBe(1696608000 * 1000);
    });

    it('should include all temperature metrics', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockSuccessResponse as AxiosResponse));

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result).toHaveProperty('temperature');
      expect(result).toHaveProperty('feelsLike');
      expect(result).toHaveProperty('tempMin');
      expect(result).toHaveProperty('tempMax');
      expect(result).toHaveProperty('humidity');
      expect(result).toHaveProperty('pressure');
    });
  });

  describe('getLocationsForCollection', () => {
    it('should return list of locations', () => {
      const locations = service.getLocationsForCollection();

      expect(locations).toBeDefined();
      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);
    });

    it('should include major cities', () => {
      const locations = service.getLocationsForCollection();
      const cityNames = locations.map(loc => loc.name);

      expect(cityNames).toContain('Hanoi');
      expect(cityNames).toContain('Tokyo');
      expect(cityNames).toContain('London');
      expect(cityNames).toContain('New York');
      expect(cityNames).toContain('Sydney');
    });

    it('should return 25 locations', () => {
      const locations = service.getLocationsForCollection();
      expect(locations).toHaveLength(25);
    });

    it('should have valid location data structure', () => {
      const locations = service.getLocationsForCollection();
      const firstLocation = locations[0];

      expect(firstLocation).toHaveProperty('name');
      expect(firstLocation).toHaveProperty('country');
      expect(firstLocation).toHaveProperty('lat');
      expect(firstLocation).toHaveProperty('lon');
      expect(typeof firstLocation.name).toBe('string');
      expect(typeof firstLocation.country).toBe('string');
      expect(typeof firstLocation.lat).toBe('number');
      expect(typeof firstLocation.lon).toBe('number');
    });

    it('should have valid coordinates', () => {
      const locations = service.getLocationsForCollection();

      locations.forEach(location => {
        expect(location.lat).toBeGreaterThanOrEqual(-90);
        expect(location.lat).toBeLessThanOrEqual(90);
        expect(location.lon).toBeGreaterThanOrEqual(-180);
        expect(location.lon).toBeLessThanOrEqual(180);
      });
    });

    it('should return same list on multiple calls', () => {
      const locations1 = service.getLocationsForCollection();
      const locations2 = service.getLocationsForCollection();

      expect(locations1).toEqual(locations2);
    });

    it('should include Vietnamese cities', () => {
      const locations = service.getLocationsForCollection();
      const vnCities = locations.filter(loc => loc.country === 'VN');

      expect(vnCities.length).toBeGreaterThan(0);
      expect(vnCities.some(city => city.name === 'Hanoi')).toBe(true);
    });
  });

  describe('fetchHistoricalData', () => {
    it('should return empty array for free tier', async () => {
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      const result = await service.fetchHistoricalData(fromDate, toDate);

      expect(result).toEqual([]);
    });

    it('should warn about free tier limitations', async () => {
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.fetchHistoricalData(fromDate, toDate);

      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should check for One Call API enabled flag', async () => {
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      await service.fetchHistoricalData(fromDate, toDate);

      expect(configService.get).toHaveBeenCalledWith('OPENWEATHER_ONE_CALL_ENABLED');
    });

    it('should log when One Call API is not enabled', async () => {
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service.fetchHistoricalData(fromDate, toDate);

      expect(loggerLogSpy).toHaveBeenCalled();
    });
  });

  describe('Integration with Circuit Breaker', () => {
    it('should use fallback when circuit breaker returns null', async () => {
      jest.spyOn(circuitBreakerService, 'execute').mockImplementation(
        async (serviceName, action, args, fallback) => {
          return fallback ? fallback(...args) : null;
        }
      );

      const result = await service.getTemperature(21.0285, 105.8542);

      expect(result).toBeNull();
    });

    it('should pass correct service name to circuit breaker', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: {
          name: 'Tokyo',
          sys: { country: 'JP' },
          main: { temp: 20, feels_like: 19, temp_min: 18, temp_max: 22, humidity: 60, pressure: 1015 },
          weather: [{ description: 'cloudy' }],
          coord: { lat: 35.6762, lon: 139.6503 },
          dt: 1696608000,
        },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.getTemperature(35.6762, 139.6503);

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'openweather',
        expect.any(Function),
        expect.any(Array),
        expect.any(Function),
      );
    });
  });

  describe('Temperature Data Validation', () => {
    it('should handle negative temperatures', async () => {
      const coldWeatherResponse = {
        data: {
          name: 'Moscow',
          sys: { country: 'RU' },
          main: {
            temp: -15.5,
            feels_like: -20.0,
            temp_min: -18.0,
            temp_max: -12.0,
            humidity: 75,
            pressure: 1020,
          },
          weather: [{ description: 'snow' }],
          coord: { lat: 55.7558, lon: 37.6173 },
          dt: 1696608000,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(coldWeatherResponse as AxiosResponse));

      const result = await service.getTemperature(55.7558, 37.6173);

      expect(result?.temperature).toBe(-15.5);
      expect(result?.feelsLike).toBe(-20.0);
    });

    it('should handle high temperatures', async () => {
      const hotWeatherResponse = {
        data: {
          name: 'Dubai',
          sys: { country: 'AE' },
          main: {
            temp: 45.0,
            feels_like: 48.0,
            temp_min: 42.0,
            temp_max: 47.0,
            humidity: 30,
            pressure: 1005,
          },
          weather: [{ description: 'sunny' }],
          coord: { lat: 25.2048, lon: 55.2708 },
          dt: 1696608000,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(hotWeatherResponse as AxiosResponse));

      const result = await service.getTemperature(25.2048, 55.2708);

      expect(result?.temperature).toBe(45.0);
    });

    it('should handle extreme humidity values', async () => {
      const highHumidityResponse = {
        data: {
          name: 'Singapore',
          sys: { country: 'SG' },
          main: {
            temp: 30.0,
            feels_like: 35.0,
            temp_min: 28.0,
            temp_max: 32.0,
            humidity: 95,
            pressure: 1010,
          },
          weather: [{ description: 'humid' }],
          coord: { lat: 1.3521, lon: 103.8198 },
          dt: 1696608000,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(highHumidityResponse as AxiosResponse));

      const result = await service.getTemperature(1.3521, 103.8198);

      expect(result?.humidity).toBe(95);
    });
  });
});
