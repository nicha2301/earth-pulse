import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IceExtentDocument = IceExtent & Document;

@Schema({ timestamps: true })
export class IceExtent {
  @Prop({ required: true, enum: ['Arctic', 'Antarctic'] })
  region: string;

  @Prop({ required: true, enum: ['N', 'S'] })
  hemisphere: string;

  @Prop({ required: true, type: Date })
  date: Date;

  @Prop({ required: true })
  extent: number; // Sea ice extent in million km²

  @Prop({ required: true, default: 0 })
  missing: number; // Missing data indicator in million km²

  @Prop({ required: true })
  source: string; // Source data file reference

  @Prop({ required: true, default: 'NSIDC' })
  dataSource: string; // NSIDC Sea Ice Index
}

export const IceExtentSchema = SchemaFactory.createForClass(IceExtent);

// Indexes for efficient queries
IceExtentSchema.index({ region: 1, date: -1 }); // Query by region, sort by date
IceExtentSchema.index({ date: -1 }); // Query all regions by date
IceExtentSchema.index({ region: 1, hemisphere: 1, date: -1 }); // Composite query
IceExtentSchema.index({ region: 1, date: 1 }, { unique: true }); // Prevent duplicates per region per day
