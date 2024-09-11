CREATE TABLE IF NOT EXISTS "chats" (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  chat_id BIGINT NOT NULL,
  task_node_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'reopened')),
  user_ids BIGINT[]
);

CREATE TABLE IF NOT EXISTS "tg-bot-sessions" (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_data TEXT NOT NULL
);

REVOKE ALL ON "tg-bot-sessions" FROM PUBLIC;
REVOKE ALL ON "chats" FROM PUBLIC;

REVOKE ALL ON "tg-bot-sessions" FROM authenticated;
REVOKE ALL ON "chats" FROM authenticated;