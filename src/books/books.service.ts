import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  // Activate or deactivate a book
  async setActive(id: number, isActive: boolean) {
    const book = await this.prisma.book.findUnique({
      where: { id },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    return this.prisma.book.update({
      where: { id },
      data: { isActive },
    });
  }

  // Get all books, including their descriptions
  async findAll() {
    return this.prisma.book.findMany();
  }

  // Get one book with borrowing history and reviews
  async findOne(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        borrowings: {
          orderBy: { borrowedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!book) {
      throw new NotFoundException(
        `Book with ID ${id} not found`,
      );
    }

    return book;
  }

  // Create a book with an optional description
  async create(data: {
    title: string;
    autor: string;
    isbn: string;
    description?: string | null;
  }) {
    return this.prisma.book.create({
      data: {
        title: data.title,
        autor: data.autor,
        isbn: data.isbn,
        description: data.description ?? null,
      },
    });
  }

  // Update book details and description
  async update(
    id: number,
    data: {
      title?: string;
      autor?: string;
      isbn?: string;
      description?: string | null;
    },
  ) {
    const book = await this.prisma.book.findUnique({
      where: { id },
    });

    if (!book) {
      throw new NotFoundException(
        `Book with ID ${id} not found`,
      );
    }

    return this.prisma.book.update({
      where: { id },
      data,
    });
  }

  // Delete a book if it has no borrowing history
  async remove(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        borrowings: true,
      },
    });

    if (!book) {
      throw new NotFoundException(
        `Book with ID ${id} not found`,
      );
    }

    if (book.borrowings.length > 0) {
      throw new ConflictException(
        'This book cannot be deleted because it has borrowing history.',
      );
    }

    return this.prisma.book.delete({
      where: { id },
    });
  }
}
