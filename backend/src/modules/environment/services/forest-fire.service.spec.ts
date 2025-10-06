import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ForestFireService } from './forest-fire.service';
import { ForestFire } from '../schemas/forest-fire.schema';
import { CacheService } from './cache.service';

describe('ForestFireService', () => {
  let service: ForestFireService;
  let cacheService: CacheService;

  const mockForestFireModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    insertMany: jest.fn(),
    create: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForestFireService,
        {
          provide: getModelToken(ForestFire.name),
          useValue: mockForestFireModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ForestFireService>(ForestFireService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveFires', () => {
    const mockFires = [
      {
        latitude: 16.5,
        longitude: 107.5,
        brightness: 320.5,
        confidence: 'high',
        frp: 12.5,
        satellite: 'MODIS',
        timestamp: new Date(),
      },
      {
        latitude: 17.2,
        longitude: 108.1,
        brightness: 330.2,
        confidence: 'nominal',
        frp: 15.3,
        satellite: 'VIIRS',
        timestamp: new Date(),
      },
    ];

    it('should return active fires from cache if available', async () => {
      mockCacheService.get.mockResolvedValue(mockFires);

      const result = await service.getActiveFires();

      expect(result).toEqual(mockFires);
      expect(mockCacheService.get).toHaveBeenCalledWith('forest-fire:active');
      expect(mockForestFireModel.find).not.toHaveBeenCalled();
    });

    it('should query database if cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockForestFireModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockFires),
          }),
        }),
      });

      const result = await service.getActiveFires();

      expect(result).toEqual(mockFires);
      expect(mockForestFireModel.find).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'forest-fire:active',
        mockFires,
        10800,
      );
    });

    it('should query fires from last 24 hours', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockForestFireModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.getActiveFires();

      expect(mockForestFireModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.objectContaining({ $gte: expect.any(Date) }),
        }),
      );
    });
  });

  describe('getFiresForMap', () => {
    it('should return fires in map format', async () => {
      const mockFires = [
        {
          latitude: 16.5,
          longitude: 107.5,
          brightness: 320.5,
          confidence: 'high',
          frp: 12.5,
          satellite: 'MODIS',
          timestamp: new Date(),
        },
      ];

      jest.spyOn(service, 'getActiveFires').mockResolvedValue(mockFires as any);

      const result = await service.getFiresForMap();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('latitude');
      expect(result[0]).toHaveProperty('longitude');
      expect(result[0]).toHaveProperty('brightness');
      expect(result[0]).toHaveProperty('confidence');
      expect(result[0]).toHaveProperty('frp');
      expect(result[0]).toHaveProperty('timestamp');
      expect(result[0]).toHaveProperty('satellite');
    });

    it('should handle empty fire list', async () => {
      jest.spyOn(service, 'getActiveFires').mockResolvedValue([]);

      const result = await service.getFiresForMap();

      expect(result).toEqual([]);
    });
  });

  describe('getFireHistory', () => {
    const mockFires = [
      {
        latitude: 16.5,
        longitude: 107.5,
        brightness: 320.5,
        confidence: 'high',
        frp: 12.5,
        timestamp: new Date('2024-01-01'),
      },
    ];

    it('should get fire history with date range', async () => {
      mockForestFireModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockFires),
            }),
          }),
        }),
      });

      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      const result = await service.getFireHistory(from, to);

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('data');
      expect(result.count).toBe(1);
      expect(result.data).toEqual(mockFires);
    });

    it('should filter by confidence level', async () => {
      mockForestFireModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockFires),
            }),
          }),
        }),
      });

      await service.getFireHistory(undefined, undefined, 'high');

      expect(mockForestFireModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: expect.any(RegExp),
        }),
      );
    });

    it('should limit results to 1000', async () => {
      const limitMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockForestFireModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: limitMock,
        }),
      });

      await service.getFireHistory();

      expect(limitMock).toHaveBeenCalledWith(1000);
    });

    it('should handle query without date filters', async () => {
      mockForestFireModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await service.getFireHistory();

      expect(result.count).toBe(0);
      expect(result.data).toEqual([]);
    });
  });

  describe('getFireStats', () => {
    const mockStats = {
      total: 150,
      byConfidence: [
        { _id: 'high', count: 50, avgFrp: 15.5 },
        { _id: 'nominal', count: 100, avgFrp: 10.2 },
      ],
      bySatellite: [
        { _id: 'MODIS', count: 80 },
        { _id: 'VIIRS', count: 70 },
      ],
    };

    it('should return stats from cache if available', async () => {
      mockCacheService.get.mockResolvedValue(mockStats);

      const result = await service.getFireStats();

      expect(result).toEqual(mockStats);
      expect(mockCacheService.get).toHaveBeenCalledWith('forest-fire:stats');
      expect(mockForestFireModel.countDocuments).not.toHaveBeenCalled();
    });

    it('should calculate stats if cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockForestFireModel.countDocuments.mockResolvedValue(150);
      mockForestFireModel.aggregate.mockResolvedValueOnce([
        { _id: 'high', count: 50, avgFrp: 15.5 },
      ]).mockResolvedValueOnce([
        { _id: 'MODIS', count: 80 },
      ]);

      const result = await service.getFireStats();

      expect(mockForestFireModel.countDocuments).toHaveBeenCalled();
      expect(mockForestFireModel.aggregate).toHaveBeenCalledTimes(2);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should use Promise.all for parallel queries', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockForestFireModel.countDocuments.mockResolvedValue(0);
      mockForestFireModel.aggregate.mockResolvedValue([]);

      await service.getFireStats();

      expect(mockForestFireModel.countDocuments).toHaveBeenCalled();
      expect(mockForestFireModel.aggregate).toHaveBeenCalled();
    });
  });

  describe('saveFiresBulk', () => {
    const mockFires = [
      {
        latitude: 16.5,
        longitude: 107.5,
        brightness: 320.5,
        confidence: 'high',
        frp: 12.5,
        satellite: 'MODIS',
        acq_date: '2024-01-01',
        acq_time: '1430',
        version: '2.0NRT',
      },
      {
        latitude: 17.2,
        longitude: 108.1,
        brightness: 330.2,
        confidence: 'nominal',
        frp: 15.3,
        satellite: 'VIIRS',
        acq_date: '2024-01-01',
        acq_time: '1530',
        version: '2.0NRT',
      },
    ];

    it('should save fires in bulk', async () => {
      mockForestFireModel.insertMany.mockResolvedValue(mockFires);

      const result = await service.saveFiresBulk(mockFires);

      expect(result).toBe(2);
      expect(mockForestFireModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            latitude: 16.5,
            longitude: 107.5,
            source: 'NASA FIRMS',
            timestamp: expect.any(Date),
          }),
        ]),
        expect.objectContaining({ ordered: false }),
      );
    });

    it('should return 0 for empty array', async () => {
      const result = await service.saveFiresBulk([]);

      expect(result).toBe(0);
      expect(mockForestFireModel.insertMany).not.toHaveBeenCalled();
    });

    it('should handle duplicate key errors', async () => {
      const duplicateError: any = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      duplicateError.result = { nInserted: 1 };
      
      mockForestFireModel.insertMany.mockRejectedValue(duplicateError);

      const result = await service.saveFiresBulk(mockFires);

      expect(result).toBe(1);
    });

    it('should invalidate cache after save', async () => {
      mockForestFireModel.insertMany.mockResolvedValue(mockFires);

      await service.saveFiresBulk(mockFires);

      expect(mockCacheService.del).toHaveBeenCalledWith('forest-fire:active');
      expect(mockCacheService.del).toHaveBeenCalledWith('forest-fire:stats');
    });
  });
});
