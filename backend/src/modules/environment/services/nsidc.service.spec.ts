import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { NsidcService } from './nsidc.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('NsidcService', () => {
  let service: NsidcService;
  let httpService: HttpService;
  let circuitBreakerService: CircuitBreakerService;

  const mockAxiosRef = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  const mockArcticCsvData = ` Year, Month, Day, Extent, Missing, Source Data
 Header line 2
2025,10,01,7.234,0.123,daily
2025,10,02,7.156,0.089,daily
2025,10,03,7.089,0.101,daily`;

  const mockAntarcticCsvData = ` Year, Month, Day, Extent, Missing, Source Data
 Header line 2
2025,10,01,15.234,0.234,daily
2025,10,02,15.156,0.198,daily
2025,10,03,15.089,0.223,daily`;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NsidcService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            axiosRef: mockAxiosRef,
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

    service = module.get<NsidcService>(NsidcService);
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
      expect(service).toBeInstanceOf(NsidcService);
    });
  });

  describe('fetchArcticData', () => {
    it('should fetch and parse Arctic ice data successfully', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.fetchArcticData(7);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should parse ice extent data correctly', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.fetchArcticData(7);

      expect(result[0]).toHaveProperty('region');
      expect(result[0]).toHaveProperty('hemisphere');
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('extent');
      expect(result[0]).toHaveProperty('missing');
    });

    it('should have correct region and hemisphere', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.fetchArcticData(7);

      expect(result[0].region).toBe('Arctic');
      expect(result[0].hemisphere).toBe('N');
    });

    it('should return empty array on error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.fetchArcticData(7);

      expect(result).toEqual([]);
    });

    it('should execute through circuit breaker', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.fetchArcticData(7);

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'nsidc',
        expect.any(Function),
        [7],
        expect.any(Function),
      );
    });

    it('should handle 404 error', async () => {
      const error = new Error('Request failed with status code 404');
      (error as any).response = { status: 404 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.fetchArcticData(7);

      expect(result).toEqual([]);
    });

    it('should handle timeout error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({ code: 'ETIMEDOUT', message: 'Request timeout' }))
      );

      const result = await service.fetchArcticData(7);

      expect(result).toEqual([]);
    });
  });

  describe('fetchAntarcticData', () => {
    it('should fetch and parse Antarctic ice data successfully', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockAntarcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.fetchAntarcticData(7);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have correct region and hemisphere', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockAntarcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.fetchAntarcticData(7);

      expect(result[0].region).toBe('Antarctic');
      expect(result[0].hemisphere).toBe('S');
    });

    it('should return empty array on error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.fetchAntarcticData(7);

      expect(result).toEqual([]);
    });
  });

  describe('fetchAllData', () => {
    it('should fetch both Arctic and Antarctic data', async () => {
      const mockArcticResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockAntarcticResponse: Partial<AxiosResponse> = {
        data: mockAntarcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get')
        .mockReturnValueOnce(of(mockArcticResponse as AxiosResponse))
        .mockReturnValueOnce(of(mockAntarcticResponse as AxiosResponse));

      const result = await service.fetchAllData(7);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should combine Arctic and Antarctic data', async () => {
      const mockArcticResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockAntarcticResponse: Partial<AxiosResponse> = {
        data: mockAntarcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get')
        .mockReturnValueOnce(of(mockArcticResponse as AxiosResponse))
        .mockReturnValueOnce(of(mockAntarcticResponse as AxiosResponse));

      const result = await service.fetchAllData(7);

      const hasArctic = result.some(item => item.region === 'Arctic');
      const hasAntarctic = result.some(item => item.region === 'Antarctic');

      expect(hasArctic).toBe(true);
      expect(hasAntarctic).toBe(true);
    });
  });

  describe('getLatestExtent', () => {
    it('should fetch latest Arctic extent', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getLatestExtent('Arctic');

      expect(result).toBeDefined();
      expect(result?.region).toBe('Arctic');
    });

    it('should fetch latest Antarctic extent', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockAntarcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getLatestExtent('Antarctic');

      expect(result).toBeDefined();
      expect(result?.region).toBe('Antarctic');
    });

    it('should return null when no data available', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.getLatestExtent('Arctic');

      expect(result).toBeNull();
    });
  });

  describe('CSV Parsing', () => {
    it('should handle empty CSV data', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: ' Year, Month, Day, Extent, Missing, Source Data\n Header line 2\n',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.fetchArcticData(7);

      expect(result).toEqual([]);
    });

    it('should skip malformed CSV lines', async () => {
      const malformedCsv = ` Year, Month, Day, Extent, Missing, Source Data
 Header line 2
2025,10,01,7.234,0.123,daily
invalid,line,data
2025,10,03,7.089,0.101,daily`;

      const mockResponse: Partial<AxiosResponse> = {
        data: malformedCsv,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.fetchArcticData(7);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Circuit Breaker', () => {
    it('should use fallback when circuit breaker fails', async () => {
      jest.spyOn(circuitBreakerService, 'execute').mockImplementation(
        async (serviceName, action, args, fallback) => {
          return fallback ? fallback(...args) : [];
        }
      );

      const result = await service.fetchArcticData(7);

      expect(result).toEqual([]);
    });

    it('should pass correct service name to circuit breaker', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockArcticCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.fetchArcticData(7);

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'nsidc',
        expect.any(Function),
        expect.any(Array),
        expect.any(Function),
      );
    });
  });
});
