import { Test, TestingModule } from '@nestjs/testing';
import { BorrowingsService } from './borrowings.service';

describe('BorrowingsService', () => {
  let service: BorrowingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BorrowingsService],
    }).compile();

    service = module.get<BorrowingsService>(BorrowingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
