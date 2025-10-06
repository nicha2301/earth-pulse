import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { IceExtentService } from './ice-extent.service';
import { IceExtent } from '../schemas/ice-extent.schema';
import { CacheService } from './cache.service';
import { NsidcService } from './nsidc.service';

describe('IceExtentService', () => {
  let service: IceExtentService;
  let cacheService: CacheService;

  const mockIceExtentModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    insertMany: jest.fn(),
    create: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockNsidcService = {
    fetchAllData: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IceExtentService,
        {
          provide: getModelToken(IceExtent.name),
          useValue: mockIceExtentModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: NsidcService,
          useValue: mockNsidcService,
        },
      ],
    }).compile();

    service = module.get<IceExtentService>(IceExtentService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLatestExtent', () => {
    const mockIceData = [
      {
        region: 'Arctic',
        hemisphere: 'N',
        date: new Date('2025-10-01'),
        extent: 5.2,
        missing: 0.5,
        source: 'NSIDC',
      },
    ];

    it('should return data from cache if available', async () => {
      mockCacheService.get.mockResolvedValue(mockIceData);

      const result = await service.getLatestExtent('Arctic');

      expect(result).toEqual(mockIceData);
      expect(mockCacheService.get).toHaveBeenCalledWith('ice-extent:latest:Arctic');
      expect(mockIceExtentModel.aggregate).not.toHaveBeenCalled();
    });

    it('should query database if cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockIceExtentModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockIceData),
      });

      const result = await service.getLatestExtent('Arctic');

      expect(result).toEqual(mockIceData);
      expect(mockIceExtentModel.aggregate).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'ice-extent:latest:Arctic',
        mockIceData,
        86400,
      );
    });

    it('should get latest for all regions when no region specified', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockIceExtentModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { region: 'Arctic', extent: 5.2 },
          { region: 'Antarctic', extent: 18.5 },
        ]),
      });

      await service.getLatestExtent();

      expect(mockCacheService.get).toHaveBeenCalledWith('ice-extent:latest:all');
    });

    it('should throw NotFoundException when no data found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockIceExtentModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(service.getLatestExtent('Invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistoricalData', () => {
    const mockHistoricalData = [
      {
        region: 'Arctic',
        date: new Date('2025-09-01'),
        extent: 5.5,
        missing: 0.4,
      },
      {
        region: 'Arctic',
        date: new Date('2025-08-01'),
        extent: 5.8,
        missing: 0.3,
      },
    ];

    it('should get historical data with date range', async () => {
      mockIceExtentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockHistoricalData),
          }),
        }),
      });

      const from = new Date('2025-08-01');
      const to = new Date('2025-09-30');
      const result = await service.getHistoricalData('Arctic', from, to);

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('data');
      expect(result.count).toBe(2);
      expect(result.data).toEqual(mockHistoricalData);
    });

    it('should filter by region and date range', async () => {
      mockIceExtentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const from = new Date('2025-01-01');
      const to = new Date('2025-12-31');
      await service.getHistoricalData('Antarctic', from, to);

      expect(mockIceExtentModel.find).toHaveBeenCalledWith({
        region: 'Antarctic',
        date: { $gte: from, $lte: to },
      });
    });

    it('should limit results to 365 days', async () => {
      const limitMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      mockIceExtentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: limitMock,
        }),
      });

      await service.getHistoricalData('Arctic', new Date(), new Date());

      expect(limitMock).toHaveBeenCalledWith(365);
    });
  });

  describe('getTrendAnalysis', () => {
    it('should calculate trend for specific region', async () => {
      mockIceExtentModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: 'Arctic',
            avgExtent: 5.5,
            minExtent: 4.2,
            maxExtent: 6.8,
            totalRecords: 365,
          },
        ]),
      });

      const result = await service.getTrendAnalysis('Arctic');

      expect(result).toBeDefined();
      expect(mockIceExtentModel.aggregate).toHaveBeenCalled();
    });

    it('should get trend for all regions when not specified', async () => {
      mockIceExtentModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: 'Arctic', avgExtent: 5.5 },
          { _id: 'Antarctic', avgExtent: 18.2 },
        ]),
      });

      const result = await service.getTrendAnalysis();

      expect(result).toBeDefined();
    });
  });

  describe('getComparison', () => {
    it('should compare Arctic and Antarctic data', async () => {
      mockIceExtentModel.aggregate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([
            { region: 'Arctic', date: new Date('2025-10-01'), extent: 5.2 },
          ]),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([
            { region: 'Antarctic', date: new Date('2025-10-01'), extent: 18.5 },
          ]),
        });

      const result = await service.getComparison();

      expect(result).toHaveProperty('arctic');
      expect(result).toHaveProperty('antarctic');
      expect(result).toHaveProperty('difference');
      expect(mockIceExtentModel.aggregate).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no data available', async () => {
      mockIceExtentModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(service.getComparison()).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics for ice extent', async () => {
      mockIceExtentModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(730),
      });
      mockIceExtentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { region: 'Arctic', extent: 5.2 },
              { region: 'Antarctic', extent: 18.5 },
            ]),
          }),
        }),
      });

      const result = await service.getStatistics();

      expect(result).toHaveProperty('totalReadings');
      expect(result).toHaveProperty('arcticReadings');
      expect(result).toHaveProperty('antarcticReadings');
      expect(mockIceExtentModel.countDocuments).toHaveBeenCalled();
    });
  });

  describe('saveIceExtentsBulk', () => {
    const mockIceExtents = [
      {
        region: 'Arctic',
        hemisphere: 'N',
        date: new Date('2025-10-01'),
        extent: 5.2,
        missing: 0.5,
        source: 'NSIDC',
      },
      {
        region: 'Antarctic',
        hemisphere: 'S',
        date: new Date('2025-10-01'),
        extent: 18.5,
        missing: 0.3,
        source: 'NSIDC',
      },
    ];

    it('should save ice extents in bulk', async () => {
      mockIceExtentModel.insertMany.mockResolvedValue(mockIceExtents);

      const result = await service.saveIceExtentsBulk(mockIceExtents);

      expect(result).toHaveProperty('saved');
      expect(result).toHaveProperty('total');
      expect(result.saved).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should handle duplicate key errors', async () => {
      const duplicateError: any = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      duplicateError.result = { nInserted: 1 };

      mockIceExtentModel.insertMany.mockRejectedValue(duplicateError);

      const result = await service.saveIceExtentsBulk(mockIceExtents);

      expect(result.saved).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should return zero for empty array', async () => {
      const result = await service.saveIceExtentsBulk([]);

      expect(result.saved).toBe(0);
      expect(result.total).toBe(0);
      expect(mockIceExtentModel.findOne).not.toHaveBeenCalled();
    });

    it('should invalidate cache after save', async () => {
      mockIceExtentModel.insertMany.mockResolvedValue(mockIceExtents);

      await service.saveIceExtentsBulk(mockIceExtents);

      expect(mockCacheService.del).toHaveBeenCalled();
    });
  });
});
