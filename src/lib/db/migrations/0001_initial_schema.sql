-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  github_username TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_github_id ON users(github_id);

-- Create diagrams table
CREATE TABLE diagrams (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  canvas_data TEXT NOT NULL,
  thumbnail_svg TEXT,
  is_blueprint INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_diagrams_owner ON diagrams(owner_id);
CREATE INDEX idx_diagrams_blueprint ON diagrams(is_blueprint) WHERE is_blueprint = 1;

-- Create diagram tags table
CREATE TABLE diagram_tags (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE(diagram_id, tag)
);

CREATE INDEX idx_tags_diagram ON diagram_tags(diagram_id);
CREATE INDEX idx_tags_tag ON diagram_tags(tag);

-- Create share tokens table
CREATE TABLE share_tokens (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_share_token ON share_tokens(token);
CREATE INDEX idx_share_diagram ON share_tokens(diagram_id);
