import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigRequirement {
  key: string;
  required: boolean;
  description: string;
  validationFn?: (value: string) => boolean;
  helpUrl?: string;
}

@Injectable()
export class ConfigValidationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationService.name);

  // Define all configuration requirements
  private readonly configRequirements: ConfigRequirement[] = [
    // Required configurations
    {
      key: 'MONGODB_URI',
      required: true,
      description: 'MongoDB connection string',
      helpUrl: 'https://www.mongodb.com/docs/manual/reference/connection-string/',
    },
    {
      key: 'REDIS_HOST',
      required: true,
      description: 'Redis server hostname',
    },
    {
      key: 'REDIS_PORT',
      required: true,
      description: 'Redis server port',
      validationFn: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
    },
    {
      key: 'OPENWEATHER_API_KEY',
      required: true,
      description: 'OpenWeatherMap API key for temperature data',
      helpUrl: 'https://openweathermap.org/api',
      validationFn: (value) => value !== 'demo' && value.length > 10,
    },
    {
      key: 'FIRMS_MAP_KEY',
      required: true,
      description: 'NASA FIRMS MAP API key for forest fire data',
      helpUrl: 'https://firms.modaps.eosdis.nasa.gov/api/area/',
    },
    
    // Optional but recommended configurations
    {
      key: 'AQICN_API_TOKEN',
      required: false,
      description: 'AQICN API token for air quality data (free from aqicn.org)',
      helpUrl: 'https://aqicn.org/data-platform/token/',
      validationFn: (value) => value !== 'demo',
    },
    {
      key: 'PORT',
      required: false,
      description: 'Application server port (default: 3000)',
      validationFn: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
    },
    {
      key: 'FRONTEND_URL',
      required: false,
      description: 'Frontend URL for CORS configuration (default: http://localhost:3001)',
    },
    
    // Feature flags
    {
      key: 'OPENWEATHER_ONE_CALL_ENABLED',
      required: false,
      description: 'Enable OpenWeather One Call API for historical temperature data (true/false)',
      validationFn: (value) => value === 'true' || value === 'false',
    },
  ];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log('🔍 Validating application configuration...');
    
    const result = this.validateConfiguration();
    
    if (result.warnings.length > 0) {
      this.logger.warn('⚠️  Configuration warnings:');
      result.warnings.forEach((warning) => this.logger.warn(`   ${warning}`));
    }
    
    if (result.errors.length > 0) {
      this.logger.error('❌ Configuration validation failed!');
      this.logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      result.errors.forEach((error) => this.logger.error(`   ${error}`));
      this.logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.error('Please fix the above configuration errors and restart the application.');
      
      // Exit application in production mode
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    } else {
      this.logger.log('✅ Configuration validation passed!');
      this.logConfigurationSummary();
    }
  }

  validateConfiguration(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const requirement of this.configRequirements) {
      const value = this.configService.get<string>(requirement.key);

      if (requirement.required) {
        // Check required configurations
        if (!value || value.trim() === '') {
          let errorMsg = `❌ ${requirement.key} is required: ${requirement.description}`;
          if (requirement.helpUrl) {
            errorMsg += `\n      Get it from: ${requirement.helpUrl}`;
          }
          errors.push(errorMsg);
          continue;
        }

        // Run custom validation if provided
        if (requirement.validationFn && !requirement.validationFn(value)) {
          errors.push(
            `❌ ${requirement.key} has invalid value: ${requirement.description}`,
          );
          continue;
        }
      } else {
        // Check optional configurations
        if (!value || value.trim() === '') {
          let warningMsg = `⚠️  ${requirement.key} not configured: ${requirement.description}`;
          if (requirement.helpUrl) {
            warningMsg += ` (${requirement.helpUrl})`;
          }
          warnings.push(warningMsg);
          continue;
        }

        // Run custom validation if provided
        if (requirement.validationFn && !requirement.validationFn(value)) {
          warnings.push(
            `⚠️  ${requirement.key} may have invalid value: ${requirement.description}`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private logConfigurationSummary() {
    this.logger.log('📋 Configuration Summary:');
    this.logger.log(`   MongoDB: ${this.configService.get('MONGODB_URI') ? '✅ Connected' : '❌ Not configured'}`);
    this.logger.log(`   Redis: ${this.configService.get('REDIS_HOST')}:${this.configService.get('REDIS_PORT')}`);
    this.logger.log(`   OpenWeather API: ${this.configService.get('OPENWEATHER_API_KEY') ? '✅ Configured' : '❌ Missing'}`);
    this.logger.log(`   NASA FIRMS API: ${this.configService.get('FIRMS_MAP_KEY') ? '✅ Configured' : '❌ Missing'}`);
    this.logger.log(`   AQICN API: ${this.configService.get('AQICN_API_TOKEN') ? '✅ Configured' : '⚠️  Using demo token'}`);
    
    const oneCallEnabled = this.configService.get('OPENWEATHER_ONE_CALL_ENABLED') === 'true';
    this.logger.log(`   OpenWeather One Call: ${oneCallEnabled ? '✅ Enabled' : '⏸️  Disabled (historical temp data not available)'}`);
    
    this.logger.log(`   Server Port: ${this.configService.get('PORT') || 3000}`);
    this.logger.log(`   Frontend URL: ${this.configService.get('FRONTEND_URL') || 'http://localhost:3001'}`);
  }

  /**
   * Get configuration value with type safety and default
   */
  getConfigOrDefault<T = string>(key: string, defaultValue: T): T {
    const value = this.configService.get<T>(key);
    return value !== undefined && value !== null ? value : defaultValue;
  }

  /**
   * Check if a feature flag is enabled
   */
  isFeatureEnabled(featureName: string): boolean {
    return this.configService.get<string>(featureName) === 'true';
  }

  /**
   * Get numeric configuration with validation
   */
  getNumericConfig(key: string, defaultValue: number, min?: number, max?: number): number {
    const value = this.configService.get<string>(key);
    
    if (!value) {
      return defaultValue;
    }

    const numValue = parseInt(value, 10);
    
    if (isNaN(numValue)) {
      this.logger.warn(`⚠️  ${key} is not a valid number, using default: ${defaultValue}`);
      return defaultValue;
    }

    if (min !== undefined && numValue < min) {
      this.logger.warn(`⚠️  ${key} is below minimum (${min}), using minimum value`);
      return min;
    }

    if (max !== undefined && numValue > max) {
      this.logger.warn(`⚠️  ${key} is above maximum (${max}), using maximum value`);
      return max;
    }

    return numValue;
  }
}
