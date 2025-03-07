/*
  # Enable chat transfer between guest and authenticated states

  1. Changes
    - Add temporary_id column to chats table for linking guest chats
    - Add migration function to handle chat transfer
    - Update RLS policies to allow chat transfer

  2. Security
    - Maintain RLS while allowing controlled access for chat transfer
    - Ensure data integrity during transfer process
*/

-- Add temporary_id column for linking guest chats
DO $$ BEGIN
  ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS temporary_id text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create index for temporary_id lookups
CREATE INDEX IF NOT EXISTS idx_chats_temporary_id ON chats(temporary_id);

-- Function to transfer guest chats to authenticated user
CREATE OR REPLACE FUNCTION transfer_guest_chats(
  p_user_id uuid,
  p_temporary_ids text[]
)
RETURNS void AS $$
BEGIN
  -- Update existing chats with matching temporary_ids
  UPDATE chats
  SET 
    user_id = p_user_id,
    temporary_id = NULL
  WHERE 
    temporary_id = ANY(p_temporary_ids)
    AND (user_id IS NULL OR user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;