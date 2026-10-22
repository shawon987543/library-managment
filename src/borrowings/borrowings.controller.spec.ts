import { Test, TestingModule } from '@nestjs/testing';
import { BorrowingsController } from './borrowings.controller';

describe('BorrowingsController', () => {
  let controller: BorrowingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BorrowingsController],
    }).compile();

    controller = module.get<BorrowingsController>(BorrowingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
