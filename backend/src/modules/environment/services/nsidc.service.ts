import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { setupAxiosRetry } from '../../../config/http.config';

interface IceExtentData {
  region: string;
  hemisphere: string;
  date: Date;
  extent: number;
  missing: number;
  source: string;
}

@Injectable()
export class NsidcService implements OnModuleInit {
  private readonly logger = new Logger(NsidcService.name);
  private readonly arcticUrl =
    'https://noaadata.apps.nsidc.org/NOAA/G02135/north/daily/data/N_seaice_extent_daily_v4.0.csv';
  private readonly antarcticUrl =
    'https://noaadata.apps.nsidc.org/NOAA/G02135/south/daily/data/S_seaice_extent_daily_v4.0.csv';

  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    setupAxiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: 1000,
      onRetry: (retryCount, error) => {
        this.logger.warn(
          `NSIDC API call failed, retry attempt ${retryCount}/3: ${error.message}`,
        );
      },
    });
    this.logger.log('✅ Retry mechanism configured for NSIDC API');
  }

  /**
   * Fetch Arctic sea ice extent data
   * @param days Number of days to fetch (default: last 7 days for latest data)
   */
  async fetchArcticData(days = 7): Promise<IceExtentData[]> {
    try {
      this.logger.log(`Fetching Arctic sea ice data (last ${days} days)...`);
      const response = await firstValueFrom(
        this.httpService.get(this.arcticUrl, {
          responseType: 'text',
        }),
      );

      return this.parseCSV(response.data, 'Arctic', 'N', days);
    } catch (error) {
      this.logger.error('Error fetching Arctic data:', error.message);
      return [];
    }
  }

  /**
   * Fetch Antarctic sea ice extent data
   * @param days Number of days to fetch (default: last 7 days for latest data)
   */
  async fetchAntarcticData(days = 7): Promise<IceExtentData[]> {
    try {
      this.logger.log(`Fetching Antarctic sea ice data (last ${days} days)...`);
      const response = await firstValueFrom(
        this.httpService.get(this.antarcticUrl, {
          responseType: 'text',
        }),
      );

      return this.parseCSV(response.data, 'Antarctic', 'S', days);
    } catch (error) {
      this.logger.error('Error fetching Antarctic data:', error.message);
      return [];
    }
  }

  /**
   * Fetch both Arctic and Antarctic data in parallel
   * @param days Number of days to fetch
   */
  async fetchAllData(days = 7): Promise<IceExtentData[]> {
    this.logger.log('Fetching both Arctic and Antarctic data...');
    const [arcticData, antarcticData] = await Promise.all([
      this.fetchArcticData(days),
      this.fetchAntarcticData(days),
    ]);

    return [...arcticData, ...antarcticData];
  }

  /**
   * Get latest extent for a specific region
   */
  async getLatestExtent(region: 'Arctic' | 'Antarctic'): Promise<IceExtentData | null> {
    const data = region === 'Arctic' 
      ? await this.fetchArcticData(1)
      : await this.fetchAntarcticData(1);

    return data.length > 0 ? data[0] : null;
  }

  /**
   * Get historical extent data for a date range
   */
  async getHistoricalExtent(
    region: 'Arctic' | 'Antarctic',
    fromDate: Date,
    toDate: Date,
  ): Promise<IceExtentData[]> {
    this.logger.log(`Fetching historical data for ${region} from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
    
    // For historical queries, fetch all data and filter
    // Note: In production, you might want to cache the full CSV
    const allData = region === 'Arctic' 
      ? await this.fetchArcticData(0) // 0 = fetch all
      : await this.fetchAntarcticData(0);

    return allData.filter(
      (item) => item.date >= fromDate && item.date <= toDate,
    );
  }

  /**
   * Parse CSV data into structured objects
   * Format: Year, Month, Day, Extent, Missing, Source Data
   */
  private parseCSV(
    csvData: string,
    region: string,
    hemisphere: string,
    limitDays = 0,
  ): IceExtentData[] {
    const lines = csvData.split('\n');
    const dataLines = lines.slice(2).filter((line) => line.trim() !== ''); // Skip 2 header lines

    let parsedData = dataLines
      .map((line) => {
        // Split by comma, but handle quoted fields
        const parts = this.parseCSVLine(line);
        
        if (parts.length < 5) {
          return null;
        }

        const year = parseInt(parts[0].trim(), 10);
        const month = parseInt(parts[1].trim(), 10);
        const day = parseInt(parts[2].trim(), 10);
        const extent = parseFloat(parts[3].trim());
        const missing = parseFloat(parts[4].trim());
        const source = parts.length > 5 ? parts[5].trim() : '';

        // Validate data
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(extent)) {
          return null;
        }

        const date = new Date(Date.UTC(year, month - 1, day));

        return {
          region,
          hemisphere,
          date,
          extent,
          missing: isNaN(missing) ? 0 : missing,
          source,
        };
      })
      .filter((item) => item !== null);

    // Sort by date descending (newest first)
    parsedData.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Limit to last N days if specified
    if (limitDays > 0) {
      parsedData = parsedData.slice(0, limitDays);
    }

    return parsedData;
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}
