import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BorrowingsController } from './borrowings.controller';
import { BorrowingsService } from './borrowings.service';

@Module({
  imports: [PrismaModule],
  controllers: [BorrowingsController],
  providers: [BorrowingsService],
  exports: [BorrowingsService],
})
export class BorrowingsModule {}
