import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CleanupService } from './cleanup.service';
import { AirQuality } from '../schemas/air-quality.schema';
import { Temperature } from '../schemas/temperature.schema';
import { ForestFire } from '../schemas/forest-fire.schema';
import { SeaLevel } from '../schemas/sea-level.schema';
import { IceExtent } from '../schemas/ice-extent.schema';
import { MetricsService } from './metrics.service';
import { RETENTION_POLICIES } from '../../../config/retention.config';

describe('CleanupService', () => {
  let service: CleanupService;
  let metricsService: MetricsService;

  const mockModel = {
    countDocuments: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    }),
    deleteMany: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      }),
    }),
  };

  const mockMetricsService = {
    trackCollectionJob: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        {
          provide: getModelToken(AirQuality.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(Temperature.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(ForestFire.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(SeaLevel.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(IceExtent.name),
          useValue: mockModel,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanupAirQuality', () => {
    it('should delete old air quality records', async () => {
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(100),
      });
      mockModel.deleteMany.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 100 }),
        }),
      });

      const result = await service.cleanupAirQuality();

      expect(result).toBe(100);
      expect(mockModel.countDocuments).toHaveBeenCalled();
      expect(mockModel.deleteMany).toHaveBeenCalled();
    });

    it('should return 0 when no records to delete', async () => {
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.cleanupAirQuality();

      expect(result).toBe(0);
      expect(mockModel.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const result = await service.cleanupAirQuality();

      expect(result).toBe(0);
      expect(metricsService.trackCollectionJob).toHaveBeenCalledWith(
        expect.stringContaining('cleanup'),
        expect.any(Number),
        false,
        0,
        'Database error',
      );
    });
  });

  describe('cleanupAllData', () => {
    it('should cleanup all data types', async () => {
      jest.spyOn(service, 'cleanupAirQuality').mockResolvedValue(100);
      jest.spyOn(service, 'cleanupTemperature').mockResolvedValue(50);
      jest.spyOn(service, 'cleanupForestFire').mockResolvedValue(200);
      jest.spyOn(service, 'cleanupSeaLevel').mockResolvedValue(75);
      jest.spyOn(service, 'cleanupIceExtent').mockResolvedValue(25);

      const result = await service.cleanupAllData();

      expect(result.airQuality).toBe(100);
      expect(result.temperature).toBe(50);
      expect(result.forestFire).toBe(200);
      expect(result.seaLevel).toBe(75);
      expect(result.iceExtent).toBe(25);
      expect(result.total).toBe(450);
    });

    it('should run cleanups sequentially', async () => {
      const callOrder: string[] = [];
      
      jest.spyOn(service, 'cleanupAirQuality').mockImplementation(async () => {
        callOrder.push('airQuality');
        return 0;
      });
      jest.spyOn(service, 'cleanupTemperature').mockImplementation(async () => {
        callOrder.push('temperature');
        return 0;
      });
      jest.spyOn(service, 'cleanupForestFire').mockImplementation(async () => {
        callOrder.push('forestFire');
        return 0;
      });
      jest.spyOn(service, 'cleanupSeaLevel').mockImplementation(async () => {
        callOrder.push('seaLevel');
        return 0;
      });
      jest.spyOn(service, 'cleanupIceExtent').mockImplementation(async () => {
        callOrder.push('iceExtent');
        return 0;
      });

      await service.cleanupAllData();

      expect(callOrder).toEqual([
        'airQuality',
        'temperature',
        'forestFire',
        'seaLevel',
        'iceExtent',
      ]);
    });
  });

  describe('getCleanupStats', () => {
    it('should return cleanup statistics', async () => {
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(50),
      });

      const stats = await service.getCleanupStats();

      expect(stats).toBeDefined();
      expect(stats.airQuality).toBeDefined();
      expect(stats.airQuality.retentionDays).toBe(RETENTION_POLICIES.airQuality);
      expect(stats.airQuality.recordsToDelete).toBe(50);
      expect(stats.isCleanupRunning).toBe(false);
    });

    it('should show cleanup is running', async () => {
      // Set cleanup as running
      service['isCleanupRunning'] = true;

      const stats = await service.getCleanupStats();

      expect(stats.isCleanupRunning).toBe(true);
    });
  });

  describe('batch deletion', () => {
    it('should delete in batches', async () => {
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2500),
      });

      // Simulate batch deletion: 3 batches of 1000
      const execMock = jest.fn()
        .mockResolvedValueOnce({ deletedCount: 1000 })
        .mockResolvedValueOnce({ deletedCount: 1000 })
        .mockResolvedValueOnce({ deletedCount: 500 });

      mockModel.deleteMany.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: execMock,
        }),
      });

      const result = await service.cleanupAirQuality();

      expect(result).toBe(2500);
      expect(execMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('manual trigger', () => {
    it('should trigger cleanup manually', async () => {
      jest.spyOn(service, 'cleanupAllData').mockResolvedValue({
        airQuality: 10,
        temperature: 5,
        forestFire: 20,
        seaLevel: 8,
        iceExtent: 2,
        total: 45,
      });

      await service.triggerManualCleanup();

      expect(service.cleanupAllData).toHaveBeenCalled();
      expect(metricsService.trackCollectionJob).toHaveBeenCalled();
    });

    it('should not run if already running', async () => {
      service['isCleanupRunning'] = true;
      const cleanupSpy = jest.spyOn(service, 'cleanupAllData');

      await service.triggerManualCleanup();

      expect(cleanupSpy).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should track failed cleanup', async () => {
      jest.spyOn(service, 'cleanupAllData').mockRejectedValue(
        new Error('Cleanup failed'),
      );

      await service.triggerManualCleanup();

      expect(metricsService.trackCollectionJob).toHaveBeenCalledWith(
        'cleanup-all',
        expect.any(Number),
        false,
        0,
        'Cleanup failed',
      );
    });

    it('should reset running flag after error', async () => {
      jest.spyOn(service, 'cleanupAllData').mockRejectedValue(
        new Error('Error'),
      );

      await service.triggerManualCleanup();

      expect(service['isCleanupRunning']).toBe(false);
    });
  });

  describe('retention policies', () => {
    it('should use correct retention periods', async () => {
      expect(RETENTION_POLICIES.airQuality).toBe(30);
      expect(RETENTION_POLICIES.temperature).toBe(60);
      expect(RETENTION_POLICIES.forestFire).toBe(90);
      expect(RETENTION_POLICIES.seaLevel).toBe(180);
      expect(RETENTION_POLICIES.iceExtent).toBe(365);
    });
  });
});
