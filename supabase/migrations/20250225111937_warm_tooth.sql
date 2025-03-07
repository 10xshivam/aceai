/*
  # Chat Synchronization Configuration

  1. Changes
    - Add last_synced column to chats table
    - Add device_id column to chats table
    - Add sync_status column to chats table
    - Add indexes for better query performance
    - Add trigger for cleaning up guest chats

  2. Security
    - Maintain existing RLS policies
    - Add automatic cleanup for guest data
*/

-- Add new columns for sync functionality
DO $$ BEGIN
  ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS last_synced timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS device_id text,
    ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create indexes for better performance
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
  CREATE INDEX IF NOT EXISTS idx_chats_last_synced ON chats(last_synced);
  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create function for cleaning up guest chats
CREATE OR REPLACE FUNCTION clean_guest_chats_trigger()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM chats 
  WHERE user_id IS NULL 
  AND created_at < NOW() - INTERVAL '1 day';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cleaning up old guest chats
DROP TRIGGER IF EXISTS clean_old_guest_chats ON chats;
CREATE TRIGGER clean_old_guest_chats
  AFTER INSERT ON chats
  FOR EACH STATEMENT
  EXECUTE FUNCTION clean_guest_chats_trigger();