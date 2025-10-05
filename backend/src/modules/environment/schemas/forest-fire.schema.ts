import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ForestFireDocument = ForestFire & Document;

@Schema({ timestamps: true })
export class ForestFire {
  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true })
  brightness: number; // Brightness temperature (Kelvin)

  @Prop({ required: true })
  confidence: string; // low, nominal, high

  @Prop({ required: true })
  frp: number; // Fire Radiative Power (MW - megawatts)

  @Prop({ required: true })
  satellite: string; // VIIRS, MODIS, etc.

  @Prop({ required: true })
  instrument: string; // VIIRS, MODIS

  @Prop({ required: true })
  acq_date: string; // Acquisition date (YYYY-MM-DD)

  @Prop({ required: true })
  acq_time: string; // Acquisition time (HHMM)

  @Prop({ required: true })
  daynight: string; // D or N (Day or Night)

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop({ default: 'NASA FIRMS' })
  source: string;

  @Prop({ type: Object })
  coordinates: {
    lat: number;
    lon: number;
  };
}

export const ForestFireSchema = SchemaFactory.createForClass(ForestFire);

// Create compound indexes for efficient queries
ForestFireSchema.index({ timestamp: -1 });
ForestFireSchema.index({ latitude: 1, longitude: 1 });
ForestFireSchema.index({ confidence: 1, timestamp: -1 });
ForestFireSchema.index({ satellite: 1, timestamp: -1 });

// Compound index for duplicate detection (used in historical collector)
ForestFireSchema.index({ latitude: 1, longitude: 1, acq_date: 1, acq_time: 1 });
