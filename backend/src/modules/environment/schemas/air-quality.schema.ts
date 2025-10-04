import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AirQualityDocument = AirQuality & Document;

@Schema({ timestamps: true })
export class AirQuality {
  @Prop({ required: true, index: true })
  city: string;

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

// Create compound index for city and timestamp
AirQualitySchema.index({ city: 1, timestamp: -1 });
