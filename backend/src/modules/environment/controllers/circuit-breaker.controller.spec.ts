import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerController } from './circuit-breaker.controller';
import { CircuitBreakerService } from '../services/circuit-breaker.service';

describe('CircuitBreakerController', () => {
  let controller: CircuitBreakerController;
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CircuitBreakerController],
      providers: [
        {
          provide: CircuitBreakerService,
          useValue: {
            getStatus: jest.fn(),
            getServiceStatus: jest.fn(),
            resetCircuit: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CircuitBreakerController>(CircuitBreakerController);
    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have getAllStats method', () => {
    expect(controller.getAllStats).toBeDefined();
  });
});
