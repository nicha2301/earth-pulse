import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface LocationData {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export interface TemperatureResponse {
  location: string;
  country: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  weatherDescription: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  timestamp: Date;
}

@Injectable()
export class OpenWeatherService {
  private readonly logger = new Logger(OpenWeatherService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('OPENWEATHER_API_KEY') || 'demo';
  }

  async getTemperature(lat: number, lon: number): Promise<TemperatureResponse | null> {
    try {
      const url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`;
      const response = await firstValueFrom(this.httpService.get(url));

      const data = response.data;

      return {
        location: data.name,
        country: data.sys.country,
        temperature: data.main.temp,
        feelsLike: data.main.feels_like,
        tempMin: data.main.temp_min,
        tempMax: data.main.temp_max,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        weatherDescription: data.weather[0]?.description || '',
        coordinates: {
          lat: data.coord.lat,
          lon: data.coord.lon,
        },
        timestamp: new Date(data.dt * 1000),
      };
    } catch (error) {
      this.logger.error(`Error fetching temperature for ${lat},${lon}:`, error.message);
      return null;
    }
  }

  // List of locations to monitor (MVP - 25 major cities worldwide)
  getLocationsForCollection(): LocationData[] {
    return [
      { name: 'Hanoi', country: 'VN', lat: 21.0285, lon: 105.8542 },
      { name: 'Ho Chi Minh City', country: 'VN', lat: 10.8231, lon: 106.6297 },
      { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 },
      { name: 'Beijing', country: 'CN', lat: 39.9042, lon: 116.4074 },
      { name: 'Delhi', country: 'IN', lat: 28.7041, lon: 77.1025 },
      { name: 'Mumbai', country: 'IN', lat: 19.076, lon: 72.8777 },
      { name: 'Shanghai', country: 'CN', lat: 31.2304, lon: 121.4737 },
      { name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198 },
      { name: 'Bangkok', country: 'TH', lat: 13.7563, lon: 100.5018 },
      { name: 'Jakarta', country: 'ID', lat: -6.2088, lon: 106.8456 },
      { name: 'Seoul', country: 'KR', lat: 37.5665, lon: 126.978 },
      { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278 },
      { name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522 },
      { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.405 },
      { name: 'New York', country: 'US', lat: 40.7128, lon: -74.006 },
      { name: 'Los Angeles', country: 'US', lat: 34.0522, lon: -118.2437 },
      { name: 'Chicago', country: 'US', lat: 41.8781, lon: -87.6298 },
      { name: 'Toronto', country: 'CA', lat: 43.6532, lon: -79.3832 },
      { name: 'Mexico City', country: 'MX', lat: 19.4326, lon: -99.1332 },
      { name: 'Sao Paulo', country: 'BR', lat: -23.5505, lon: -46.6333 },
      { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093 },
      { name: 'Melbourne', country: 'AU', lat: -37.8136, lon: 144.9631 },
      { name: 'Moscow', country: 'RU', lat: 55.7558, lon: 37.6173 },
      { name: 'Dubai', country: 'AE', lat: 25.2048, lon: 55.2708 },
      { name: 'Cairo', country: 'EG', lat: 30.0444, lon: 31.2357 },
    ];
  }
}
