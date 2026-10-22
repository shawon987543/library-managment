import {
  Injectable, ConflictException, UnauthorizedException, InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getAdmins(){
    return this.prisma.user.findMany({
        where:{
            role: 'ADMIN',
        },
        select:{
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
        },
    });
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      message: 'Registration successful',
      user,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    console.log('Login account role:', user.role);
    return this.issueTokens(user.id, user.email, user.role);
  }


  private async issueTokens(userId: number, email: string, role: 'USER' | 'ADMIN') {
    const accessSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) {
      throw new InternalServerErrorException(
        'JWT secrets are not configured',
      );
    }

    const payload = {
      sub: userId,
      email,
      role,
    };

    const accessToken = await this.jwtService.signAsync(
      payload,
      {
        secret: accessSecret,
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      payload,
      {
        secret: refreshSecret,
        expiresIn: '7d',
      },
    );

    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      10,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return {
      message: 'Authentication successful',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      throw new InternalServerErrorException(
        'Refresh token secret is not configured',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
      }>(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException(
          'Invalid refresh token',
        );
      }
      const matches = await bcrypt.compare(
        refreshToken,
        user.refreshTokenHash,
      );

      if (!matches) {
        throw new UnauthorizedException(
          'Invalid refresh token',
        );
      }
    
      
      return await this.issueTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }
  }
  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return {
      message: 'Logout successful',
    };
  }
}
