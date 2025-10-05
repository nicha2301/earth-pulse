import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AirQualityDocument = AirQuality & Document;

@Schema({ timestamps: true })
export class AirQuality {
  @Prop({ required: true, index: true })
  city: string;

  @Prop({ required: true, index: true })
  cityLower: string; // Lowercase version for case-insensitive queries

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  aqi: number;

  @Prop()
  level: string;

  @Prop({ type: Object })
  pollutants: {
    pm25?: number;
    pm10?: number;
    o3?: number;
    no2?: number;
    so2?: number;
    co?: number;
  };

  @Prop({ type: Object, required: true })
  coordinates: {
    lat: number;
    lon: number;
  };

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop()
  source: string;
}

export const AirQualitySchema = SchemaFactory.createForClass(AirQuality);

// Create compound indexes for efficient queries
AirQualitySchema.index({ city: 1, timestamp: -1 });
AirQualitySchema.index({ cityLower: 1, timestamp: -1 }); // For case-insensitive searches
