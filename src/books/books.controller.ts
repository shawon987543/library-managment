import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { BooksService } from './books.service';
import { JWTAuthGuard } from '../auth/jwt-auth.guard';

@Controller('books')
@UseGuards(JWTAuthGuard)
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
  ) {}

  // Get all books.
  @Get()
  findAll() {
    return this.booksService.findAll();
  }

  // Get one book with borrowing history and reviews.
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.booksService.findOne(id);
  }

  // Create a book.
  @Post()
  create(
    @Body()
    body: {
      title: string;
      autor: string;
      isbn: string;
      genre?: string;
      description?: string | null;
    },
  ) {
    return this.booksService.create(body);
  }

  // Update book details.
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      title?: string;
      autor?: string;
      isbn?: string;
      genre?: string;
      description?: string | null;
    },
  ) {
    return this.booksService.update(id, body);
  }

  // Activate or deactivate a book.
  @Patch(':id/status')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean },
  ) {
    return this.booksService.setActive(
      id,
      body.isActive,
    );
  }

  // Delete a book if it has no borrowing history.
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.booksService.remove(id);
  }
}
