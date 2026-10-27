import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  // Get all saved genres
  async findAll() {
    return this.prisma.genre.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Add a new genre
  async create(name: string) {
    const genreName = name?.trim();

    if (!genreName) {
      throw new BadRequestException('Genre name is required.');
    }

    try {
      return await this.prisma.genre.create({
        data: { name: genreName },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This genre already exists.',
        );
      }

      throw error;
    }
  }
}