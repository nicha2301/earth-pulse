import { Test, TestingModule } from '@nestjs/testing';
import { CollectorController } from './collector.controller';
import { CollectorService } from '../services/collector.service';
import { MetricsService } from '../services/metrics.service';

describe('CollectorController', () => {
  let controller: CollectorController;
  let service: CollectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectorController],
      providers: [
        {
          provide: CollectorService,
          useValue: {
            collectAllData: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            trackCollectionJob: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CollectorController>(CollectorController);
    service = module.get<CollectorService>(CollectorService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
