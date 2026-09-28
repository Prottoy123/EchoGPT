import { Module } from '@nestjs/common';
import { AIProvidersService } from './ai-providers.service';
import { AIProvidersController } from './ai-providers.controller';

@Module({
  controllers: [AIProvidersController],
  providers: [AIProvidersService],
  exports: [AIProvidersService],
})
export class AIProvidersModule {}
