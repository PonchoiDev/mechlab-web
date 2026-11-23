-- Builds publicadas (docs/specs/builds-publicadas.md). Se aplica con:
--   npx wrangler d1 migrations apply mechlab-builds --remote
-- Se guarda el código de la build, el mismo de los enlaces; la clave de edición y la IP, solo como hash.
CREATE TABLE builds (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('mercs', 'battletech')),
  mech_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  edit_key_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  -- 1 cuando la ocultan las denuncias.
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX builds_by_game ON builds (game, hidden, created_at DESC);
CREATE INDEX builds_by_ip ON builds (ip_hash, created_at);

-- Un voto y una denuncia por build y por IP.
CREATE TABLE build_votes (
  build_id TEXT NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  PRIMARY KEY (build_id, ip_hash)
);

CREATE TABLE build_reports (
  build_id TEXT NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  PRIMARY KEY (build_id, ip_hash)
);
