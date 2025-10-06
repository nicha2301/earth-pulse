import { Test, TestingModule } from '@nestjs/testing';
import { SeaLevelController } from './sea-level.controller';
import { SeaLevelService } from '../services/sea-level.service';

describe('SeaLevelController', () => {
  let controller: SeaLevelController;
  let service: SeaLevelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeaLevelController],
      providers: [
        {
          provide: SeaLevelService,
          useValue: {
            getStationList: jest.fn(),
            getLatestByStation: jest.fn(),
            getAllLatest: jest.fn(),
            getHistoricalData: jest.fn(),
            getMapData: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SeaLevelController>(SeaLevelController);
    service = module.get<SeaLevelService>(SeaLevelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have getAllStations method', () => {
    expect(controller.getAllStations).toBeDefined();
  });

  it('should have getSeaLevelMap method', () => {
    expect(controller.getSeaLevelMap).toBeDefined();
  });
});
