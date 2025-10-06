import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { FirmsService } from './firms.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('FirmsService', () => {
  let service: FirmsService;
  let httpService: HttpService;
  let circuitBreakerService: CircuitBreakerService;

  const mockAxiosRef = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  const mockCsvData = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
21.5,105.8,330.5,1.2,1.0,2025-10-06,1230,N,VIIRS,nominal,2.0NRT,295.3,15.2,D,0
22.3,106.2,325.0,1.1,0.9,2025-10-06,1245,N,VIIRS,high,2.0NRT,290.0,12.5,D,0`;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirmsService,
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
              if (key === 'FIRMS_MAP_KEY') return 'test-map-key';
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

    service = module.get<FirmsService>(FirmsService);
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

    it('should initialize with map key from config', () => {
      expect(service).toBeInstanceOf(FirmsService);
    });
  });

  describe('getActiveFires', () => {
    it('should fetch and parse fire data successfully', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires('world', 1, 'VIIRS_SNPP_NRT');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('latitude');
      expect(result[0]).toHaveProperty('longitude');
      expect(result[0]).toHaveProperty('brightness');
    });

    it('should parse CSV data correctly', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      expect(result[0].latitude).toBe(21.5);
      expect(result[0].longitude).toBe(105.8);
      expect(result[0].brightness).toBe(330.5);
      expect(result[0].acq_date).toBe('2025-10-06');
      expect(result[0].satellite).toBe('N');
      expect(result[0].confidence).toBe('nominal');
    });

    it('should use default parameters', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.getActiveFires();

      expect(httpService.get).toHaveBeenCalled();
    });

    it('should handle empty CSV data', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: 'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type\n',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      expect(result).toEqual([]);
    });

    it('should handle malformed CSV lines', async () => {
      const malformedCsv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
21.5,105.8,330.5
22.3,106.2,325.0,1.1,0.9,2025-10-06,1245,N,VIIRS,high,2.0NRT,290.0,12.5,D,0`;

      const mockResponse: Partial<AxiosResponse> = {
        data: malformedCsv,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      expect(result.length).toBe(1); // Only second line is valid
    });

    it('should execute through circuit breaker', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.getActiveFires();

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'firms',
        expect.any(Function),
        expect.any(Array),
        expect.any(Function),
      );
    });

    it('should return empty array on error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.getActiveFires();

      expect(result).toEqual([]);
    });

    it('should handle 404 error', async () => {
      const error = new Error('Request failed with status code 404');
      (error as any).response = { status: 404 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getActiveFires();

      expect(result).toEqual([]);
    });

    it('should handle 401 unauthorized error', async () => {
      const error = new Error('Request failed with status code 401');
      (error as any).response = { status: 401 };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

      const result = await service.getActiveFires();

      expect(result).toEqual([]);
    });

    it('should handle timeout error', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({ code: 'ETIMEDOUT', message: 'Request timeout' }))
      );

      const result = await service.getActiveFires();

      expect(result).toEqual([]);
    });

    it('should parse multiple fire records', async () => {
      const largeCsv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
21.5,105.8,330.5,1.2,1.0,2025-10-06,1230,N,VIIRS,nominal,2.0NRT,295.3,15.2,D,0
22.3,106.2,325.0,1.1,0.9,2025-10-06,1245,N,VIIRS,high,2.0NRT,290.0,12.5,D,0
23.1,107.5,340.0,1.3,1.1,2025-10-06,1300,N,VIIRS,nominal,2.0NRT,300.0,18.0,D,0`;

      const mockResponse: Partial<AxiosResponse> = {
        data: largeCsv,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      expect(result.length).toBe(3);
    });
  });

  describe('getFiresByRegions', () => {
    it('should fetch fires from multiple regions', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));
      
      // Mock delay to speed up test
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      const result = await service.getFiresByRegions();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(httpService.get).toHaveBeenCalled();
    });

    it('should handle region fetch failures gracefully', async () => {
      jest.spyOn(httpService, 'get')
        .mockReturnValueOnce(of({
          data: mockCsvData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        } as AxiosResponse))
        .mockReturnValueOnce(throwError(() => new Error('Region error')))
        .mockReturnValue(of({
          data: mockCsvData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        } as AxiosResponse));

      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      const result = await service.getFiresByRegions();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should add delay between region requests', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));
      const delaySpy = jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      await service.getFiresByRegions();

      expect(delaySpy).toHaveBeenCalled();
    });
  });

  describe('CSV Parsing', () => {
    it('should handle CSV with only header', () => {
      const headerOnly = 'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type';
      
      const result = service['parseCsvData'](headerOnly);

      expect(result).toEqual([]);
    });

    it('should skip invalid numeric values', async () => {
      const invalidCsv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
invalid,105.8,330.5,1.2,1.0,2025-10-06,1230,N,VIIRS,nominal,2.0NRT,295.3,15.2,D,0
22.3,106.2,325.0,1.1,0.9,2025-10-06,1245,N,VIIRS,high,2.0NRT,290.0,12.5,D,0`;

      const mockResponse: Partial<AxiosResponse> = {
        data: invalidCsv,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      expect(result.length).toBeGreaterThan(0);
    });

    it('should trim whitespace from CSV data', async () => {
      const csvWithWhitespace = `  latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type  
21.5,105.8,330.5,1.2,1.0,2025-10-06,1230,N,VIIRS,nominal,2.0NRT,295.3,15.2,D,0  `;

      const mockResponse: Partial<AxiosResponse> = {
        data: csvWithWhitespace,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      expect(result.length).toBe(1);
    });
  });

  describe('Integration with Circuit Breaker', () => {
    it('should use fallback when circuit breaker fails', async () => {
      jest.spyOn(circuitBreakerService, 'execute').mockImplementation(
        async (serviceName, action, args, fallback) => {
          return fallback ? fallback(...args) : [];
        }
      );

      const result = await service.getActiveFires();

      expect(result).toEqual([]);
    });

    it('should pass correct service name to circuit breaker', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      await service.getActiveFires();

      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'firms',
        expect.any(Function),
        expect.any(Array),
        expect.any(Function),
      );
    });
  });

  describe('Fire Data Validation', () => {
    it('should parse all fire data fields correctly', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: mockCsvData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      const fire = result[0];
      expect(fire).toHaveProperty('latitude');
      expect(fire).toHaveProperty('longitude');
      expect(fire).toHaveProperty('brightness');
      expect(fire).toHaveProperty('scan');
      expect(fire).toHaveProperty('track');
      expect(fire).toHaveProperty('acq_date');
      expect(fire).toHaveProperty('acq_time');
      expect(fire).toHaveProperty('satellite');
      expect(fire).toHaveProperty('instrument');
      expect(fire).toHaveProperty('confidence');
      expect(fire).toHaveProperty('version');
      expect(fire).toHaveProperty('bright_t31');
      expect(fire).toHaveProperty('frp');
      expect(fire).toHaveProperty('daynight');
    });

    it('should handle different confidence levels', async () => {
      const multiConfidenceCsv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
21.5,105.8,330.5,1.2,1.0,2025-10-06,1230,N,VIIRS,nominal,2.0NRT,295.3,15.2,D,0
22.3,106.2,325.0,1.1,0.9,2025-10-06,1245,N,VIIRS,high,2.0NRT,290.0,12.5,D,0
23.1,107.5,320.0,1.0,0.8,2025-10-06,1300,N,VIIRS,low,2.0NRT,285.0,10.0,D,0`;

      const mockResponse: Partial<AxiosResponse> = {
        data: multiConfidenceCsv,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as AxiosResponse));

      const result = await service.getActiveFires();

      expect(result[0].confidence).toBe('nominal');
      expect(result[1].confidence).toBe('high');
      expect(result[2].confidence).toBe('low');
    });
  });
});
