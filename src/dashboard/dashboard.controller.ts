import {
  Controller,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JWTAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    sub?: number | string;
    id?: number | string;
    userId?: number | string;
  };
}

@Controller('dashboard')
@UseGuards(JWTAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get('me')
  async getMyDashboard(@Req() req: AuthenticatedRequest) {
    const rawUserId =
      req.user?.sub ?? req.user?.id ?? req.user?.userId;

    const userId = Number(rawUserId);

    if (!rawUserId || !Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException(
        'A valid user ID was not found in the access token.',
      );
    }

    return this.dashboardService.getMyDashboard(userId);
  }
}
