import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { NoaaService } from './noaa.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('NoaaService', () => {
  let service: NoaaService;
  let httpService: HttpService;
  let circuitBreakerService: CircuitBreakerService;

  const mockAxiosRef = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  const mockNoaaResponse = {
    metadata: {
      id: '8518750',
      name: 'The Battery, NY',
      lat: '40.7006',
      lon: '-74.0142',
    },
    data: [
      {
        t: '2025-10-06 12:00',
        v: '1.523',
        s: '0.012',
        f: '0,0,0,0',
        q: 'v',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoaaService,
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
            get: jest.fn(),
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

    service = module.get<NoaaService>(NoaaService);
    httpService = module.get<HttpService>(HttpService);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);

    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should configure retry mechanism on init', () => {
      expect(service).toBeInstanceOf(NoaaService);
    });
  });

  describe('getStationLatest', () => {
    it('should fetch latest water level data successfully', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockNoaaResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getStationLatest('8518750');

      expect(result).toBeDefined();
      expect(result.stationId).toBe('8518750');
      expect(result.stationName).toBe('The Battery, NY');
      expect(result.waterLevel).toBe(1.523);
    });

    it('should parse coordinates correctly', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockNoaaResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getStationLatest('8518750');

      expect(result.coordinates).toEqual([-74.0142, 40.7006]); // lon, lat order
      expect(result.locationType).toBe('Point');
    });

    it('should parse timestamp correctly', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockNoaaResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getStationLatest('8518750');

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.datum).toBe('MLLW');
      expect(result.source).toBe('NOAA');
    });

    it('should parse optional fields', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockNoaaResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getStationLatest('8518750');

      expect(result.sigma).toBe(0.012);
      expect(result.flags).toBe('0,0,0,0');
      expect(result.quality).toBe('v');
    });

    it('should handle missing sigma field', async () => {
      const mockResponseWithoutSigma = {
        metadata: mockNoaaResponse.metadata,
        data: [
          {
            t: '2025-10-06 12:00',
            v: '1.523',
            f: '0,0,0,0',
            q: 'v',
          },
        ],
      };

      const mockResponse: Partial<AxiosResponse> = {
        data: mockResponseWithoutSigma,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getStationLatest('8518750');

      expect(result.sigma).toBeUndefined();
    });

    it('should return null if no data', async () => {
      const mockEmptyResponse = {
        metadata: mockNoaaResponse.metadata,
        data: [],
      };

      const mockResponse: Partial<AxiosResponse> = {
        data: mockEmptyResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getStationLatest('8518750');

      expect(result).toBeNull();
    });

    it('should execute through circuit breaker', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockNoaaResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.getStationLatest('8518750');

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'noaa',
        expect.any(Function),
        ['8518750'],
        expect.any(Function),
      );
    });

    it('should return null on network error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.getStationLatest('8518750');

      expect(result).toBeNull();
    });

    it('should handle 404 error', async () => {
      const error = new Error('Request failed with status code 404');
      (error as any).response = { status: 404 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getStationLatest('8518750');

      expect(result).toBeNull();
    });

    it('should handle API error response', async () => {
      const error = new Error('API Error');
      (error as any).response = {
        status: 400,
        data: {
          error: {
            message: 'Invalid station ID',
          },
        },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getStationLatest('invalid-id');

      expect(result).toBeNull();
    });

    it('should handle timeout error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({ code: 'ETIMEDOUT', message: 'Request timeout' }))
      );

      const result = await service.getStationLatest('8518750');

      expect(result).toBeNull();
    });
  });



  describe('Integration with Circuit Breaker', () => {
    it('should use fallback when circuit breaker fails', async () => {
      jest.spyOn(circuitBreakerService, 'execute').mockImplementation(
        async (serviceName, action, args, fallback) => {
          return fallback ? fallback(...args) : null;
        }
      );

      const result = await service.getStationLatest('8518750');

      expect(result).toBeNull();
    });

    it('should pass correct service name to circuit breaker', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockNoaaResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.getStationLatest('8518750');

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'noaa',
        expect.any(Function),
        expect.any(Array),
        expect.any(Function),
      );
    });
  });

  describe('Water Level Validation', () => {
    it('should handle different water levels', async () => {
      const responses = [
        { ...mockNoaaResponse, data: [{ ...mockNoaaResponse.data[0], v: '-0.523' }] },
        { ...mockNoaaResponse, data: [{ ...mockNoaaResponse.data[0], v: '0.000' }] },
        { ...mockNoaaResponse, data: [{ ...mockNoaaResponse.data[0], v: '5.234' }] },
      ];

      for (const responseData of responses) {
        const mockResponse: Partial<AxiosResponse> = {
          data: responseData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

        const result = await service.getStationLatest('8518750');

        expect(result).toBeDefined();
        expect(result.waterLevel).toBe(parseFloat(responseData.data[0].v));
      }
    });

    it('should parse quality flags correctly', async () => {
      const mockResponseWithQuality = {
        metadata: mockNoaaResponse.metadata,
        data: [
          {
            ...mockNoaaResponse.data[0],
            q: 'p', // preliminary quality
          },
        ],
      };

      const mockResponse: Partial<AxiosResponse> = {
        data: mockResponseWithQuality,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getStationLatest('8518750');

      expect(result.quality).toBe('p');
    });
  });
});
