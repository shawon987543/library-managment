
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';

import { FavoritesService } from './favorites.service';
import { JWTAuthGuard } from '../auth/jwt-auth.guard';

@Controller('favorites')
@UseGuards(JWTAuthGuard)
export class FavoritesController {
  constructor(
    private readonly favoritesService: FavoritesService,
  ) {}

  private getUserId(req: any): number {
    const rawId =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId;

    const userId = Number(rawId);

    if (
      rawId === undefined ||
      rawId === null ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new Error(
        'Authenticated JWT must contain a valid user ID',
      );
    }

    return userId;
  }

  @Get()
  getMyFavorites(@Req() req: any) {
    return this.favoritesService.getMyFavorites(
      this.getUserId(req),
    );
  }

  @Post(':bookId')
  addFavorite(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Req() req: any,
  ) {
    return this.favoritesService.addFavorite(
      this.getUserId(req),
      bookId,
    );
  }

  @Delete(':bookId')
  removeFavorite(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Req() req: any,
  ) {
    return this.favoritesService.removeFavorite(
      this.getUserId(req),
      bookId,
    );
  }
}
