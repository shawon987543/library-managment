-- AlterTable
ALTER TABLE "Borrowing" ADD COLUMN     "dueData" TIMESTAMP(3),
ADD COLUMN     "renewalCount" INTEGER NOT NULL DEFAULT 0;
