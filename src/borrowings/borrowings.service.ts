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

  // Get borrowing records for the authenticated user.
  async findAll(userId: number) {
    return this.prisma.borrowing.findMany({
      where: { userId },
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

  // Borrow a book and set the initial due date to 14 days.
  async borrowBook(userId: number, bookId: number) {
    if (!Number.isSafeInteger(bookId) || bookId <= 0) {
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

      const borrowedAt = new Date();
      const dueDate = new Date(borrowedAt);
      dueDate.setDate(dueDate.getDate() + 14);

      return tx.borrowing.create({
        data: {
          userId,
          bookId,
          borrowedAt,
          dueDate,
          renewalCount: 0,
        },
      });
    });
  }

  // Return a borrowed book.
  async returnBook(id: number, userId: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException(
        'A valid borrowing ID is required',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const borrowing = await tx.borrowing.findUnique({
        where: { id },
      });

      if (!borrowing) {
        throw new NotFoundException(
          'Borrowing record not found',
        );
      }

      // Only the borrower can return their own book.
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

      // Claim the return only once.
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
          'Available quantity has reached the maximum limit',
        );
      }

      return {
        message: 'Book returned successfully',
      };
    });
  }

  // Renew a borrowed book for another 14 days.
  // Maximum: 2 renewals per borrowing.
  async renewBook(id: number, userId: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException(
        'A valid borrowing ID is required',
      );
    }

    const MAX_RENEWALS = 2;
    const RENEWAL_DAYS = 14;

    return this.prisma.$transaction(async (tx) => {
      const borrowing = await tx.borrowing.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!borrowing) {
        throw new NotFoundException(
          'Borrowing record not found for your account',
        );
      }

      if (borrowing.returnedAt) {
        throw new BadRequestException(
          'A returned book cannot be renewed',
        );
      }

      // Older records without a due date get a fallback date.
      const currentDueDate =
        borrowing.dueDate ??
        new Date(
          borrowing.borrowedAt.getTime() +
            RENEWAL_DAYS * 24 * 60 * 60 * 1000,
        );

      if (currentDueDate.getTime() <= Date.now()) {
        throw new BadRequestException(
          'Overdue books cannot be renewed',
        );
      }

      if (borrowing.renewalCount >= MAX_RENEWALS) {
        throw new BadRequestException(
          'Maximum renewal limit reached',
        );
      }

      const newDueDate = new Date(currentDueDate);
      newDueDate.setDate(
        newDueDate.getDate() + RENEWAL_DAYS,
      );

      // Conditional update prevents overwriting a changed record.
      const result = await tx.borrowing.updateMany({
        where: {
          id,
          userId,
          returnedAt: null,
          renewalCount: borrowing.renewalCount,
          dueDate: borrowing.dueDate,
        },
        data: {
          dueDate: newDueDate,
          renewalCount: {
            increment: 1,
          },
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          'Renewal failed because the borrowing record changed. Please try again.',
        );
      }

      return {
        message: 'Book renewed successfully',
        borrowingId: id,
        dueDate: newDueDate,
        renewalCount: borrowing.renewalCount + 1,
        renewalsRemaining:
          MAX_RENEWALS - borrowing.renewalCount - 1,
      };
    });
  }
}
