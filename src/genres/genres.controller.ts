import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { GenresService } from './genres.service';
import { JWTAuthGuard } from '../auth/jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user?: {
    role?: string;
  };
};

@Controller('genres')
@UseGuards(JWTAuthGuard)
export class GenresController {
  constructor(
    private readonly genresService: GenresService,
  ) {}

  @Get()
  findAll() {
    return this.genresService.findAll();
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name: string },
  ) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only administrators can add genres.',
      );
    }

    return this.genresService.create(body.name);
  }
}