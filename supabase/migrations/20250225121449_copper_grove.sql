-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own chats" ON chats;
DROP POLICY IF EXISTS "Users can manage messages in their chats" ON messages;

-- Create new policies for chats table with broader access
CREATE POLICY "Allow all access to chats"
ON chats
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create new policies for messages table with broader access
CREATE POLICY "Allow all access to messages"
ON messages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled but with broader policies
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;