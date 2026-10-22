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
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JWTAuthGuard } from '../auth/jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';
import { UpdatePasswordDto } from '../auth/dto/update-password.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    sub?: number;
    email?: string;
    role?: string;
  };
}

@Controller('users')
@UseGuards(JWTAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}


  
  private getAuthenticatedUserId(req:{
    user?: {
        id?: number;
        sub?: number;
        userId?: number;
    };
  }): number {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.userId;

    if (typeof userId !== 'number' || !Number.isInteger(userId)) {
      throw new UnauthorizedException(
        'Authenticated user ID is missing from the JWT payload',
      );
    }

    return userId;
  }
  @Get()
    getAllUsers() {
     return this.usersService.findAll();
}
  // Existing user profile endpoint
  @Get(':id/profile')
  getProfile(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.getProfile(id);
  }

  // Get favorites for the currently logged-in user
  @Get('me/favorites')
  getFavoriteBooks(@Req() req: AuthenticatedRequest) {
    const userId = this.getAuthenticatedUserId(req);

    return this.usersService.getFavoriteBooks(userId!);
  }

  // Add a book to the current user's favorites
  @Post('me/favorites/:bookId')
  addFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    return this.usersService.addFavorite(userId!, bookId);
  }


  // Remove a book from the current user's favorites
  @Delete('me/favorites/:bookId')
  removeFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    const userId = this.getAuthenticatedUserId(req);

    return this.usersService.removeFavorite(userId!, bookId);
  }
}
