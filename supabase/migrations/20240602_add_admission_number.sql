-- Migration: Add admission_number column (nullable) and unique index
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  name text,
  email text UNIQUE,
  admission_number text NULL
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admission_number text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_admission_number_idx ON profiles (admission_number);
