import type { BuildGame, BuildStore, PublishedBuild, StoredBuild } from './builds';

// Tipos mínimos de D1, la base de datos de Cloudflare, para lo que usa este almacén.
interface D1Result<T> {
  results: T[];
  meta: { changes: number };
}

interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement;
  all: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<D1Result<unknown>>;
}

export interface D1Database {
  prepare: (query: string) => D1PreparedStatement;
}

interface BuildRow {
  id: string;
  game: BuildGame;
  mech_id: string;
  code: string;
  name: string;
  description: string;
  author: string;
  created_at: string;
  updated_at: string;
  votes: number;
  edit_key_hash: string;
  ip_hash: string;
}

const PUBLIC_COLUMNS = 'id, game, mech_id, code, name, description, author, created_at, updated_at, votes';

const toPublic = (row: BuildRow): PublishedBuild => ({
  id: row.id,
  game: row.game,
  mechId: row.mech_id,
  code: row.code,
  name: row.name,
  description: row.description,
  author: row.author,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  votes: row.votes
});

// Las tablas están en migrations/0001_published_builds.sql. Las builds ocultas por denuncias no salen.
export const createD1BuildStore = (db: D1Database): BuildStore => {
  // Los votos se cuentan de nuevo tras cada cambio, para que la columna no se desvíe de la tabla de votos.
  const recountVotes = async (id: string) => {
    const row = await db.prepare('UPDATE builds SET votes = (SELECT COUNT(*) FROM build_votes WHERE build_id = ?1) WHERE id = ?1 RETURNING votes')
      .bind(id).first<{ votes: number }>();
    return row?.votes ?? 0;
  };

  return {
    list: async (game, limit) => {
      const { results } = await db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM builds WHERE game = ? AND hidden = 0 ORDER BY created_at DESC LIMIT ?`)
        .bind(game, limit).all<BuildRow>();
      return results.map(toPublic);
    },
    get: async id => {
      const row = await db.prepare(`SELECT ${PUBLIC_COLUMNS}, edit_key_hash, ip_hash FROM builds WHERE id = ? AND hidden = 0`)
        .bind(id).first<BuildRow>();
      return row ? { ...toPublic(row), editKeyHash: row.edit_key_hash, ipHash: row.ip_hash } satisfies StoredBuild : null;
    },
    countPublishedSince: async (ipHash, since) => {
      const row = await db.prepare('SELECT COUNT(*) AS count FROM builds WHERE ip_hash = ? AND created_at >= ?')
        .bind(ipHash, since).first<{ count: number }>();
      return row?.count ?? 0;
    },
    insert: async build => {
      await db.prepare(`INSERT INTO builds (${PUBLIC_COLUMNS}, edit_key_hash, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(build.id, build.game, build.mechId, build.code, build.name, build.description, build.author,
          build.createdAt, build.updatedAt, build.votes, build.editKeyHash, build.ipHash)
        .run();
    },
    update: async (id, texts, updatedAt) => {
      await db.prepare('UPDATE builds SET name = ?, description = ?, author = ?, updated_at = ? WHERE id = ?')
        .bind(texts.name, texts.description, texts.author, updatedAt, id).run();
    },
    remove: async id => {
      await db.prepare('DELETE FROM build_votes WHERE build_id = ?').bind(id).run();
      await db.prepare('DELETE FROM build_reports WHERE build_id = ?').bind(id).run();
      await db.prepare('DELETE FROM builds WHERE id = ?').bind(id).run();
    },
    addVote: async (id, ipHash) => {
      const { meta } = await db.prepare('INSERT OR IGNORE INTO build_votes (build_id, ip_hash) VALUES (?, ?)').bind(id, ipHash).run();
      return meta.changes === 0 ? null : recountVotes(id);
    },
    removeVote: async (id, ipHash) => {
      const { meta } = await db.prepare('DELETE FROM build_votes WHERE build_id = ? AND ip_hash = ?').bind(id, ipHash).run();
      return meta.changes === 0 ? null : recountVotes(id);
    },
    addReport: async (id, ipHash) => {
      const { meta } = await db.prepare('INSERT OR IGNORE INTO build_reports (build_id, ip_hash) VALUES (?, ?)').bind(id, ipHash).run();
      if (meta.changes === 0) return null;
      const row = await db.prepare('SELECT COUNT(*) AS count FROM build_reports WHERE build_id = ?').bind(id).first<{ count: number }>();
      return row?.count ?? 0;
    },
    hide: async id => {
      await db.prepare('UPDATE builds SET hidden = 1 WHERE id = ?').bind(id).run();
    }
  };
};
