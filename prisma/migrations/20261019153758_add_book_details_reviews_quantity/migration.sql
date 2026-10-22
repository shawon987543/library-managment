
-- Temporarily remove the foreign key that depends on User_id_key
ALTER TABLE "Borrowing"
DROP CONSTRAINT "Borrowing_userId_fkey";

-- Add book description and quantity fields
ALTER TABLE "Book"
ADD COLUMN "availableCopies" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "description" TEXT,
ADD COLUMN "totalCopies" INTEGER NOT NULL DEFAULT 5;

-- Add primary key to User
ALTER TABLE "User"
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- Remove the old unique index after adding the primary key
DROP INDEX "User_id_key";

-- Restore the Borrowing foreign key
ALTER TABLE "Borrowing"
ADD CONSTRAINT "Borrowing_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Create Review table
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- Ensure each user can review a book only once
CREATE UNIQUE INDEX "Review_userId_bookId_key"
ON "Review"("userId", "bookId");

-- Add Review foreign keys
ALTER TABLE "Review"
ADD CONSTRAINT "Review_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Review"
ADD CONSTRAINT "Review_bookId_fkey"
FOREIGN KEY ("bookId")
REFERENCES "Book"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
