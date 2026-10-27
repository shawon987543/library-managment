DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Borrowing'
      AND column_name = 'dueData'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Borrowing'
      AND column_name = 'dueDate'
  ) THEN
    ALTER TABLE "Borrowing"
      RENAME COLUMN "dueData" TO "dueDate";
  END IF;
END $$;