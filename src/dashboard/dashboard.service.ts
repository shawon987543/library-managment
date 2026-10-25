import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getMyDashboard(userId: number) {
    const [
      totalBorrowings,
      currentBorrowings,
      returnedBorrowings,
    ] = await Promise.all([
      this.prisma.borrowing.count({
        where: { userId },
      }),

      this.prisma.borrowing.count({
        where: {
          userId,
          returnedAt: null,
        },
      }),

      this.prisma.borrowing.count({
        where: {
          userId,
          returnedAt: { not: null },
        },
      }),
    ]);

    const recentActivity =
      await this.prisma.borrowing.findMany({
        where: { userId },
        orderBy: { borrowedAt: 'desc' },
        take: 5,
        include: {
          book: {
            select: {
              id: true,
              title: true,
              autor: true,
            },
          },
        },
      });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        favorites:{
            select:{
                id: true,
                book: {
                    select:{
                        id: true,
                        title: true,
                        autor: true,
                    },
                },
            },
        },
      },
    });

    return {
      totalBorrowings,
      currentBorrowings,
      returnedBorrowings,

      // Replace with a real due-date calculation
      // once your Borrowing schema is confirmed.
      overdueBorrowings: 0,

      recentActivity,

      // Placeholder until renewal records are implemented.
      renewalSummary: {
        requested: 0,
        approved: 0,
        rejected: 0,
      },

      favoriteBooks: user?.favorites.map((favorite) => favorite.book) ?? [],
    };
  }
}
