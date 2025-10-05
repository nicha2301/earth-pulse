import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { setupAxiosRetry } from '../../../config/http.config';
import { CircuitBreakerService } from './circuit-breaker.service';

export interface AqicnResponse {
  city: string;
  country: string;
  aqi: number;
  level: string;
  pollutants: {
    pm25?: number;
    pm10?: number;
    o3?: number;
    no2?: number;
    so2?: number;
    co?: number;
  };
  coordinates: {
    lat: number;
    lon: number;
  };
  timestamp: Date;
}

@Injectable()
export class AqicnService implements OnModuleInit {
  private readonly logger = new Logger(AqicnService.name);
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.waqi.info';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    const token = this.configService.get<string>('AQICN_API_TOKEN');
    
    if (!token || token === 'demo') {
      this.logger.warn(
        '⚠️  AQICN_API_TOKEN not configured or using demo key. ' +
        'Please get a free API key from https://aqicn.org/data-platform/token/ ' +
        'and set it in your .env file. Demo token has severe rate limits and may not work reliably.'
      );
      this.apiToken = 'demo'; // Fallback to demo for backward compatibility
    } else {
      this.logger.log('✅ AQICN API configured with valid token');
      this.apiToken = token;
    }
  }

  onModuleInit() {
    // Setup retry mechanism for AQICN API calls
    setupAxiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: 1000,
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn(
          `AQICN API retry ${retryCount}/3: ${requestConfig.url}`,
          { error: error.message },
        );
      },
    });
    this.logger.log('✅ AQICN service initialized with retry mechanism');
  }

  async getAirQuality(city: string): Promise<AqicnResponse | null> {
    // Define the API call action
    const fetchAction = async (cityName: string) => {
      const url = `${this.baseUrl}/feed/${cityName}/?token=${this.apiToken}`;
      const response = await firstValueFrom(this.httpService.get(url));

      if (response.data.status !== 'ok') {
        this.logger.warn(`AQICN API returned non-ok status for ${cityName}`);
        return null;
      }

      const data = response.data.data;

      // Validate AQI value - sometimes API returns "-" or invalid data
      if (!data.aqi || data.aqi === '-' || isNaN(Number(data.aqi))) {
        this.logger.warn(`Invalid AQI value for ${cityName}: ${data.aqi}`);
        return null;
      }

      const aqiValue = Number(data.aqi);

      // Validate timestamp
      const timestamp = new Date(data.time.iso);
      if (isNaN(timestamp.getTime())) {
        this.logger.warn(`Invalid timestamp for ${cityName}: ${data.time.iso}`);
        return null;
      }

      // Get AQI level based on value
      const level = this.getAqiLevel(aqiValue);

      return {
        city: data.city.name.split(',')[0].trim(),
        country: this.extractCountry(data.city.name),
        aqi: aqiValue,
        level,
        pollutants: {
          pm25: data.iaqi?.pm25?.v,
          pm10: data.iaqi?.pm10?.v,
          o3: data.iaqi?.o3?.v,
          no2: data.iaqi?.no2?.v,
          so2: data.iaqi?.so2?.v,
          co: data.iaqi?.co?.v,
        },
        coordinates: {
          lat: data.city.geo[0],
          lon: data.city.geo[1],
        },
        timestamp: timestamp,
      };
    };

    // Define fallback function
    const fallback = async (cityName: string) => {
      this.logger.warn(`🔄 Using fallback for ${cityName} - circuit breaker open or service unavailable`);
      return null;
    };

    // Execute through circuit breaker
    try {
      return await this.circuitBreakerService.execute(
        'aqicn',
        fetchAction,
        [city],
        fallback,
      );
    } catch (error) {
      this.logger.error(`Error fetching air quality for ${city}:`, error.message);
      return null;
    }
  }

  private getAqiLevel(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  private extractCountry(cityName: string): string {
    const parts = cityName.split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : 'Unknown';
  }

  // List of cities to monitor (MVP - 20 major cities)
  getCitiesForCollection(): string[] {
    return [
      'hanoi',
      'ho-chi-minh-city',
      'tokyo',
      'beijing',
      'delhi',
      'mumbai',
      'shanghai',
      'singapore',
      'bangkok',
      'jakarta',
      'seoul',
      'london',
      'paris',
      'new-york',
      'los-angeles',
      'sao-paulo',
      'sydney',
      'toronto',
      'moscow',
      'dubai',
    ];
  }
}
