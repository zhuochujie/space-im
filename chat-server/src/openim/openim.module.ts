import { Module } from '@nestjs/common';
import { OpenImService } from './openim.service';

@Module({
  providers: [OpenImService],
  exports: [OpenImService],
})
export class OpenImModule {}
