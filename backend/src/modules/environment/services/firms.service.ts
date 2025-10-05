import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { setupAxiosRetry } from '../../../config/http.config';

interface FirmsFireData {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  instrument: string;
  confidence: string;
  version: string;
  bright_t31: number;
  frp: number;
  daynight: string;
}

@Injectable()
export class FirmsService implements OnModuleInit {
  private readonly logger = new Logger(FirmsService.name);
  private readonly baseUrl = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
  private readonly mapKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.mapKey = this.configService.get<string>('FIRMS_MAP_KEY') || '';
  }

  onModuleInit() {
    setupAxiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: 1000,
      onRetry: (retryCount, error) => {
        this.logger.warn(
          `FIRMS API call failed, retry attempt ${retryCount}/3: ${error.message}`,
        );
      },
    });
    this.logger.log('✅ Retry mechanism configured for FIRMS API');
  }

  /**
   * Get active fires for a specific region
   * @param area Area coordinates: 'world' or 'west,south,east,north'
   * @param days Number of days to query (1-10)
   * @param source Satellite source (default: VIIRS_SNPP_NRT)
   */
  async getActiveFires(
    area: string = 'world',
    days: number = 1,
    source: string = 'VIIRS_SNPP_NRT',
  ): Promise<FirmsFireData[]> {
    try {
      const url = `${this.baseUrl}/${this.mapKey}/${source}/${area}/${days}`;
      
      this.logger.log(`Fetching fires from FIRMS: ${url}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Accept': 'text/csv',
          },
        }),
      );

      // Parse CSV data
      const fires = this.parseCsvData(response.data);
      
      this.logger.log(`Successfully fetched ${fires.length} fire detections`);
      
      return fires;
    } catch (error) {
      this.logger.error(`Failed to fetch fires from FIRMS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get fires for specific regions (multiple continents/countries)
   */
  async getFiresByRegions(): Promise<FirmsFireData[]> {
    const regions = [
      { name: 'North America', coords: '-170,15,-50,75' },
      { name: 'South America', coords: '-85,-57,-32,14' },
      { name: 'Europe', coords: '-10,35,40,70' },
      { name: 'Africa', coords: '-20,-35,55,40' },
      { name: 'Asia', coords: '40,-10,150,55' },
      { name: 'Australia', coords: '110,-45,155,-10' },
    ];

    const allFires: FirmsFireData[] = [];

    for (const region of regions) {
      try {
        const fires = await this.getActiveFires(region.coords, 1);
        allFires.push(...fires);
        this.logger.log(`Fetched ${fires.length} fires from ${region.name}`);
        
        // Add delay to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        this.logger.warn(`Failed to fetch fires from ${region.name}: ${error.message}`);
      }
    }

    return allFires;
  }

  /**
   * Parse CSV data from FIRMS API
   */
  private parseCsvData(csvData: string): FirmsFireData[] {
    const lines = csvData.trim().split('\n');
    
    if (lines.length < 2) {
      return [];
    }

    // Skip header line
    const dataLines = lines.slice(1);
    
    const fires: FirmsFireData[] = [];

    for (const line of dataLines) {
      try {
        const values = line.split(',');
        
        if (values.length < 15) {
          continue;
        }

        fires.push({
          latitude: parseFloat(values[0]),
          longitude: parseFloat(values[1]),
          brightness: parseFloat(values[2]),
          scan: parseFloat(values[3]),
          track: parseFloat(values[4]),
          acq_date: values[5],
          acq_time: values[6],
          satellite: values[7],
          instrument: values[8],
          confidence: values[9],
          version: values[10],
          bright_t31: parseFloat(values[11]),
          frp: parseFloat(values[12]),
          daynight: values[13],
        });
      } catch (error) {
        this.logger.warn(`Failed to parse fire data line: ${line}`);
      }
    }

    return fires;
  }

  /**
   * Filter fires by confidence level
   */
  filterByConfidence(fires: FirmsFireData[], confidence: string): FirmsFireData[] {
    return fires.filter(fire => fire.confidence.toLowerCase() === confidence.toLowerCase());
  }

  /**
   * Get fire count by region (basic grouping by lat/lon ranges)
   */
  getFireStatsByRegion(fires: FirmsFireData[]): Record<string, number> {
    const stats: Record<string, number> = {
      'North America': 0,
      'South America': 0,
      'Europe': 0,
      'Africa': 0,
      'Asia': 0,
      'Australia': 0,
      'Other': 0,
    };

    for (const fire of fires) {
      const region = this.determineRegion(fire.latitude, fire.longitude);
      stats[region]++;
    }

    return stats;
  }

  /**
   * Determine region based on coordinates
   */
  private determineRegion(lat: number, lon: number): string {
    // North America
    if (lat >= 15 && lat <= 75 && lon >= -170 && lon <= -50) {
      return 'North America';
    }
    // South America
    if (lat >= -57 && lat <= 14 && lon >= -85 && lon <= -32) {
      return 'South America';
    }
    // Europe
    if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 40) {
      return 'Europe';
    }
    // Africa
    if (lat >= -35 && lat <= 40 && lon >= -20 && lon <= 55) {
      return 'Africa';
    }
    // Asia
    if (lat >= -10 && lat <= 55 && lon >= 40 && lon <= 150) {
      return 'Asia';
    }
    // Australia
    if (lat >= -45 && lat <= -10 && lon >= 110 && lon <= 155) {
      return 'Australia';
    }
    return 'Other';
  }

  /**
   * Fetch historical fire data from NASA FIRMS archive
   * Note: NASA provides historical data through their archive system
   * For recent months (last 10 days), use getActiveFires()
   * For older data, we'll collect from archive files or API with date ranges
   * 
   * @param fromDate Start date
   * @param toDate End date
   * @param source Satellite source (MODIS_C6_1 or VIIRS_SNPP)
   */
  async fetchHistoricalData(
    fromDate: Date,
    toDate: Date,
    source: string = 'VIIRS_SNPP_NRT',
  ): Promise<FirmsFireData[]> {
    this.logger.log(`Fetching historical fire data from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
    
    const allFires: FirmsFireData[] = [];
    
    // NASA FIRMS API limitation: Can only fetch last 10 days via standard API
    // For true historical data, we would need to:
    // 1. Use FIRMS Archive downloads (requires different authentication)
    // 2. Or collect data day by day within the 10-day window
    
    // For now, we'll implement a workaround: collect available data within API limits
    // and note that full historical requires archive access
    
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    
    // If requested date range is within last 10 days, we can use standard API
    if (fromDate >= tenDaysAgo) {
      const daysFromNow = Math.ceil((now.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
      const daysToFetch = Math.min(daysFromNow, 10);
      
      this.logger.log(`Fetching ${daysToFetch} days of recent fire data`);
      
      try {
        const fires = await this.getActiveFires('world', daysToFetch, source);
        
        // Filter fires within the requested date range
        const filtered = fires.filter(fire => {
          const fireDate = new Date(fire.acq_date);
          return fireDate >= fromDate && fireDate <= toDate;
        });
        
        allFires.push(...filtered);
        this.logger.log(`Fetched ${filtered.length} fires within date range`);
      } catch (error) {
        this.logger.error(`Error fetching fires: ${error.message}`);
      }
    } else {
      this.logger.warn(
        `Requested date range is older than 10 days. NASA FIRMS standard API only supports last 10 days. ` +
        `For true historical data, use FIRMS Archive or collect data over time.`
      );
      
      // For demonstration, try to fetch what we can (last 10 days)
      try {
        const fires = await this.getActiveFires('world', 10, source);
        this.logger.log(`Fetched ${fires.length} fires from last 10 days (closest available data)`);
        
        // Note: In production, you would integrate with FIRMS Archive FTP here
        // or implement a scheduled job to collect and store data daily
      } catch (error) {
        this.logger.error(`Error fetching fires: ${error.message}`);
      }
    }
    
    return allFires;
  }

  /**
   * Fetch historical fire data by month
   * This is a helper method to make it easier to collect monthly data
   * 
   * @param year Year (e.g., 2024)
   * @param month Month (1-12)
   * @param source Satellite source
   */
  async fetchHistoricalDataByMonth(
    year: number,
    month: number,
    source: string = 'VIIRS_SNPP_NRT',
  ): Promise<FirmsFireData[]> {
    // Create date range for the entire month
    const fromDate = new Date(year, month - 1, 1); // month is 0-indexed in Date
    const toDate = new Date(year, month, 0, 23, 59, 59); // Last day of month
    
    this.logger.log(`Fetching fire data for ${year}-${month.toString().padStart(2, '0')}`);
    
    return this.fetchHistoricalData(fromDate, toDate, source);
  }

  /**
   * Get available date range for historical data
   * NASA FIRMS provides different ranges depending on satellite
   */
  getAvailableDateRange(source: string): { from: string; to: string; note: string } {
    const ranges: Record<string, { from: string; to: string; note: string }> = {
      'MODIS_C6_1': {
        from: '2000-11-01',
        to: 'present',
        note: 'MODIS Collection 6.1 - Available from November 2000',
      },
      'VIIRS_SNPP_NRT': {
        from: '2012-01-20',
        to: 'present',
        note: 'VIIRS S-NPP - Available from January 2012',
      },
      'VIIRS_NOAA20_NRT': {
        from: '2018-01-01',
        to: 'present',
        note: 'VIIRS NOAA-20 - Available from January 2018',
      },
    };

    return ranges[source] || {
      from: 'unknown',
      to: 'unknown',
      note: 'Unknown satellite source',
    };
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
