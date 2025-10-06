import { Test, TestingModule } from '@nestjs/testing';
import { IceExtentController } from './ice-extent.controller';
import { IceExtentService } from '../services/ice-extent.service';

describe('IceExtentController', () => {
  let controller: IceExtentController;
  let service: IceExtentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IceExtentController],
      providers: [
        {
          provide: IceExtentService,
          useValue: {
            getLatestExtent: jest.fn(),
            getTrendData: jest.fn(),
            getComparisonData: jest.fn(),
            getStats: jest.fn(),
            getHistoricalExtent: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<IceExtentController>(IceExtentController);
    service = module.get<IceExtentService>(IceExtentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have getLatest method', () => {
    expect(controller.getLatest).toBeDefined();
  });

  it('should have getTrend method', () => {
    expect(controller.getTrend).toBeDefined();
  });

  it('should have getComparison method', () => {
    expect(controller.getComparison).toBeDefined();
  });

  it('should have getHistory method', () => {
    expect(controller.getHistory).toBeDefined();
  });
});
