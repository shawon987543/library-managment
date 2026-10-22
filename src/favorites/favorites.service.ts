
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async addFavorite(userId: number, bookId: number) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // The compound unique constraint prevents duplicates.
    await this.prisma.favorite.upsert({
      where: {
        userId_bookId: { userId, bookId },
      },
      create: { userId, bookId },
      update: {},
    });

    return {
      message: 'Book added to favorites',
    };
  }

  async removeFavorite(userId: number, bookId: number) {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_bookId: { userId, bookId },
      },
    });

    if (!favorite) {
      throw new NotFoundException(
        'This book is not in your favorites',
      );
    }

    await this.prisma.favorite.delete({
      where: {
        userId_bookId: { userId, bookId },
      },
    });

    return {
      message: 'Book removed from favorites',
    };
  }

  async getMyFavorites(userId: number) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            autor: true,
            isbn: true,
          },
        },
      },
    });

    return favorites.map((favorite) => favorite.book);
  }
}
