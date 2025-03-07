/*
  # Chat System Schema

  1. Tables
    - `chats`: Stores chat sessions
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `created_at` (timestamp)
    
    - `messages`: Stores chat messages
      - `id` (uuid, primary key)
      - `chat_id` (uuid, references chats)
      - `role` (text)
      - `content` (text)
      - `thinking` (text, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own chats and messages
*/

-- Create chats table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS chats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create messages table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid REFERENCES chats ON DELETE CASCADE NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    thinking text,
    created_at timestamptz DEFAULT now()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Enable RLS
DO $$ BEGIN
  ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage their own chats" ON chats;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage messages in their chats" ON messages;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
DO $$ BEGIN
  CREATE POLICY "Users can manage their own chats"
    ON chats
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage messages in their chats"
    ON messages
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = messages.chat_id
        AND chats.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = messages.chat_id
        AND chats.user_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;