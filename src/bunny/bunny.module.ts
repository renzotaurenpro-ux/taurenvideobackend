import { Module } from '@nestjs/common';
import { BunnyService } from './bunny.service.js';

@Module({
  providers: [BunnyService],
  exports: [BunnyService],
})
export class BunnyModule {}
