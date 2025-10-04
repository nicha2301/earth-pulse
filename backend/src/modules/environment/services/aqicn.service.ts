import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
export class AqicnService {
  private readonly logger = new Logger(AqicnService.name);
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.waqi.info';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiToken = this.configService.get<string>('AQICN_API_TOKEN') || 'demo';
  }

  async getAirQuality(city: string): Promise<AqicnResponse | null> {
    try {
      const url = `${this.baseUrl}/feed/${city}/?token=${this.apiToken}`;
      const response = await firstValueFrom(this.httpService.get(url));

      if (response.data.status !== 'ok') {
        this.logger.warn(`AQICN API returned non-ok status for ${city}`);
        return null;
      }

      const data = response.data.data;

      // Get AQI level based on value
      const level = this.getAqiLevel(data.aqi);

      return {
        city: data.city.name.split(',')[0].trim(),
        country: this.extractCountry(data.city.name),
        aqi: data.aqi,
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
        timestamp: new Date(data.time.iso),
      };
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
