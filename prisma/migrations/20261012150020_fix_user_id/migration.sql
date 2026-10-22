-- Add automatic ID generation while preserving the existing unique index.
CREATE SEQUENCE user_id_seq;

SELECT setval(
  'user_id_seq',
  COALESCE((SELECT MAX("id") FROM "User"), 0) + 1,
  false
);

ALTER TABLE "User"
ALTER COLUMN "id" SET DEFAULT nextval('user_id_seq');

ALTER SEQUENCE user_id_seq OWNED BY "User"."id";