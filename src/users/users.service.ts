import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  }

  // Add a book to the current user's favorites
  async addFavorite(userId: number, bookId: number) {
    // Check that the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check that the book exists and is active
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Prevent favoriting a deactivated book
    if (!book.isActive) {
      throw new BadRequestException(
        'This book is deactivated and cannot be added to favorites.',
      );
    }

    // Check whether this book is already a favorite
    const existingFavorite =
      await this.prisma.favorite.findUnique({
        where: {
          userId_bookId: {
            userId,
            bookId,
          },
        },
      });

    if (existingFavorite) {
      return {
        message: 'Book is already in favorites',
      };
    }

    // Create the favorite record
    await this.prisma.favorite.create({
      data: {
        userId,
        bookId,
      },
    });

    return {
      message: 'Book added to favorites successfully',
    };
  }

  // Remove a book from favorites
  async removeFavorite(
    userId: number,
    bookId: number,
  ) {
    const favorite =
      await this.prisma.favorite.findUnique({
        where: {
          userId_bookId: {
            userId,
            bookId,
          },
        },
      });

    if (!favorite) {
      return {
        message: 'Book is not in favorites',
      };
    }

    await this.prisma.favorite.delete({
      where: {
        userId_bookId: {
          userId,
          bookId,
        },
      },
    });

    return {
      message: 'Book removed from favorites successfully',
    };
  }

  // Get favorites for the currently logged-in user
  async getFavoriteBooks(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        favorites: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                autor: true,
                isbn: true,
                available: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hide deactivated books from the favorites list
    return user.favorites
      .filter((favorite) => favorite.book.isActive)
      .map((favorite) => favorite.book);
  }

  // USER PROFILE SECTION
  async getProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,

        favorites: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            book: {
              select: {
                id: true,
                title: true,
                autor: true,
                isbn: true,
                isActive: true,
              },
            },
          },
        },

        borrowings: {
          orderBy: {
            borrowedAt: 'desc',
          },
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
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Count borrowing records for each book
    const bookCounts = new Map<
      number,
      {
        book: (typeof user.borrowings)[number]['book'];
        borrowCount: number;
      }
    >();

    for (const borrowing of user.borrowings) {
      const existing = bookCounts.get(
        borrowing.bookId,
      );

      if (existing) {
        existing.borrowCount += 1;
      } else {
        bookCounts.set(borrowing.bookId, {
          book: borrowing.book,
          borrowCount: 1,
        });
      }
    }

    // Get the five most borrowed books
    const mostBorrowedBooks = Array.from(
      bookCounts.values(),
    )
      .sort(
        (a, b) => b.borrowCount - a.borrowCount,
      )
      .slice(0, 5);

    // Count currently borrowed and returned books
    const currentlyBorrowed =
      user.borrowings.filter(
        (borrowing) =>
          borrowing.returnedAt === null,
      ).length;

    const returnedBooks =
      user.borrowings.filter(
        (borrowing) =>
          borrowing.returnedAt !== null,
      ).length;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,

      statistics: {
        totalBorrowings: user.borrowings.length,
        currentlyBorrowed,
        returnedBooks,
        favoriteBooks: user.favorites.length,
      },

      // Exclude deactivated books from profile favorites
      favoriteBooks: user.favorites
        .filter((favorite) => favorite.book.isActive)
        .map((favorite) => favorite.book),

      mostBorrowedBooks,

      borrowingHistory: user.borrowings,
    };
  }
}