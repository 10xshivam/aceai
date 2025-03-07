/*
  # Fix RLS policies for chat synchronization

  1. Changes
    - Drop existing policies
    - Create new, more permissive policies for authenticated users
    - Add policies for messages table
    - Fix sync-related policies

  2. Security
    - Ensure users can only access their own chats and messages
    - Allow proper sync operations
    - Maintain data isolation between users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own chats" ON chats;
DROP POLICY IF EXISTS "Users can manage messages in their chats" ON messages;

-- Create new policies for chats table
CREATE POLICY "Users can manage their own chats"
ON chats
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);

-- Create new policies for messages table
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

-- Ensure RLS is enabled
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;