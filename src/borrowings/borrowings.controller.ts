import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { BorrowingsService } from './borrowings.service';
import { JWTAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: number | string;
    sub?: number | string;
    userId?: number | string;
  };
}

@Controller('borrowings')
@UseGuards(JWTAuthGuard)
export class BorrowingsController {
  constructor(
    private readonly borrowingsService: BorrowingsService,
  ) {}

  private getAuthenticatedUserId(
    req: AuthenticatedRequest,
  ): number {
    const rawId =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId;

    const userId = Number(rawId);

    if (
      rawId === undefined ||
      rawId === null ||
      rawId === '' ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new UnauthorizedException(
        'Invalid authenticated user ID',
      );
    }

    return userId;
  }

  @Post()
  borrowBook(
    @Req() req: AuthenticatedRequest,
    @Body() body: { bookId: number },
  ) {
    const userId = this.getAuthenticatedUserId(req);

    return this.borrowingsService.borrowBook(
      userId,
      body.bookId,
    );
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    const userId = this.getAuthenticatedUserId(req);
    return this.borrowingsService.findAll(userId);
  }

  @Patch(':id/return')
  returnBook(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    return this.borrowingsService.returnBook(id, userId);
  }
}
