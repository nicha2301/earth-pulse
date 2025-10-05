import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TemperatureDocument = Temperature & Document;

@Schema({ timestamps: true })
export class Temperature {
  @Prop({ required: true, index: true })
  location: string;

  @Prop({ required: true, index: true })
  locationLower: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  temperature: number;

  @Prop()
  feelsLike: number;

  @Prop()
  tempMin: number;

  @Prop()
  tempMax: number;

  @Prop()
  humidity: number;

  @Prop()
  pressure: number;

  @Prop()
  weatherDescription: string;

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

export const TemperatureSchema = SchemaFactory.createForClass(Temperature);

// Create compound indexes for efficient queries
TemperatureSchema.index({ location: 1, timestamp: -1 });
TemperatureSchema.index({ locationLower: 1, timestamp: -1 }); // For case-insensitive searches
