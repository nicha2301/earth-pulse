import { Controller, Get, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CircuitBreakerService } from '../services/circuit-breaker.service';

@ApiTags('Circuit Breaker')
@Controller('circuit-breaker')
export class CircuitBreakerController {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get health status of all circuit breakers' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker health status',
  })
  getHealthStatus() {
    return this.circuitBreakerService.getHealthStatus();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get statistics for all circuit breakers' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker statistics',
  })
  getAllStats() {
    return this.circuitBreakerService.getAllStats();
  }

  @Get('stats/:service')
  @ApiOperation({ summary: 'Get statistics for a specific service' })
  @ApiParam({ name: 'service', description: 'Service name (aqicn, openweather, firms, noaa, nsidc)' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker statistics for the service',
  })
  @ApiResponse({
    status: 404,
    description: 'Service not found',
  })
  getStats(@Param('service') service: string) {
    const stats = this.circuitBreakerService.getStats(service);
    if (!stats) {
      return {
        error: 'Service not found',
        message: `No circuit breaker found for service: ${service}`,
        availableServices: ['aqicn', 'openweather', 'firms', 'noaa', 'nsidc'],
      };
    }
    return stats;
  }

  @Post('open/:service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually open a circuit breaker' })
  @ApiParam({ name: 'service', description: 'Service name' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker opened',
  })
  openCircuit(@Param('service') service: string) {
    this.circuitBreakerService.open(service);
    return {
      message: `Circuit breaker opened for ${service}`,
      service,
      status: 'open',
    };
  }

  @Post('close/:service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually close a circuit breaker' })
  @ApiParam({ name: 'service', description: 'Service name' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker closed',
  })
  closeCircuit(@Param('service') service: string) {
    this.circuitBreakerService.close(service);
    return {
      message: `Circuit breaker closed for ${service}`,
      service,
      status: 'closed',
    };
  }

  @Post('clear/:service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear statistics for a service' })
  @ApiParam({ name: 'service', description: 'Service name' })
  @ApiResponse({
    status: 200,
    description: 'Statistics cleared',
  })
  clearStats(@Param('service') service: string) {
    this.circuitBreakerService.clearStats(service);
    return {
      message: `Statistics cleared for ${service}`,
      service,
    };
  }
}
