-- Create chat_messages table for storing conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- For now, allow all operations (we can add user authentication later)
CREATE POLICY "Allow all operations on chat_messages" ON chat_messages
    FOR ALL USING (true);

-- Create a view for getting conversation history
CREATE OR REPLACE VIEW conversation_history AS
SELECT 
    session_id,
    role,
    content,
    message_type,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) as message_order
FROM chat_messages
ORDER BY session_id, created_at;

-- Add comments for documentation
COMMENT ON TABLE chat_messages IS 'Stores chat messages for the AI chatbot application';
COMMENT ON COLUMN chat_messages.session_id IS 'Unique identifier for a chat session';
COMMENT ON COLUMN chat_messages.role IS 'Role of the message sender (user or assistant)';
COMMENT ON COLUMN chat_messages.content IS 'The actual message content';
COMMENT ON COLUMN chat_messages.message_type IS 'Type of message (text or image)';
