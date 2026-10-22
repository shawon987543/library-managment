import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BorrowingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(userId: number) {
    return this.prisma.borrowing.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        book: {
          select: {
            id: true,
            title: true,
            autor: true,
            isbn: true,
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async borrowBook(userId: number, bookId: number) {
    if (
      !Number.isSafeInteger(bookId) ||
      bookId <= 0
    ) {
      throw new BadRequestException(
        'A valid book ID is required',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const book = await tx.book.findUnique({
        where: { id: bookId },
      });

      if (!book) {
        throw new NotFoundException('Book not found');
      }

      if (!book.isActive) {
        throw new BadRequestException(
          'This book is deactivated and cannot be borrowed',
        );
      }

      if (book.availableCopies <= 0) {
        throw new BadRequestException(
          'No copies of this book are available',
        );
      }

      // Atomically reserve one available copy.
      const result = await tx.book.updateMany({
        where: {
          id: bookId,
          isActive: true,
          availableCopies: { gt: 0 },
        },
        data: {
          availableCopies: { decrement: 1 },
          available: book.availableCopies > 1,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          'No copies of this book are available',
        );
      }

      return tx.borrowing.create({
        data: {
          userId,
          bookId,
        },
      });
    });
  }

  async returnBook(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const borrowing = await tx.borrowing.findUnique({
        where: { id },
      });

      if (!borrowing) {
        throw new NotFoundException(
          'Borrowing record not found',
        );
      }

      // Only the borrower may return this record.
      if (borrowing.userId !== userId) {
        throw new BadRequestException(
          'You can only return books borrowed by your account',
        );
      }

      if (borrowing.returnedAt) {
        throw new BadRequestException(
          'Book has already been returned',
        );
      }

      // Claim the return only if it has not already happened.
      const result = await tx.borrowing.updateMany({
        where: {
          id,
          userId,
          returnedAt: null,
        },
        data: {
          returnedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          'This book has already been returned',
        );
      }

      const book = await tx.book.findUnique({
        where: { id: borrowing.bookId },
      });

      if (!book ){
        throw new NotFoundException('Book not found');
      }

      const bookResult = await tx.book.updateMany({
        where: {
          id: borrowing.bookId,
          availableCopies: { lt: 2147483647 },
        },
        data: {
          availableCopies: { increment: 1 },
          available: true,
        },
      });

      if (bookResult.count !== 1) {
        throw new BadRequestException(
          'Available quantity has reached the total copy limit',
        );
      }

      return {
        message: 'Book returned successfully',
      };
    });
  }
}