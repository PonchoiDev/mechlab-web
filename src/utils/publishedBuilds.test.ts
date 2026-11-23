import { describe, expect, it } from 'vitest';
import { parseOwnedKeys, parseVotedIds, sortByVotes, toSavedBuild, type PublishedBuild } from './publishedBuilds';

const build = (id: string, votes: number, createdAt: string): PublishedBuild => ({
  id,
  game: 'mercs',
  mechId: 'AS7-D',
  code: 'code',
  name: `Build ${id}`,
  description: '',
  author: '',
  createdAt,
  updatedAt: createdAt,
  votes
});

describe('builds publicadas en el navegador', () => {
  it('lee las claves de edición guardadas e ignora lo dañado', () => {
    expect(parseOwnedKeys(JSON.stringify({ a1: 'key1', b2: 'key2' }))).toEqual({ a1: 'key1', b2: 'key2' });
    expect(parseOwnedKeys(JSON.stringify({ a1: 'key1', b2: 3, c3: null }))).toEqual({ a1: 'key1' });
    expect(parseOwnedKeys('not json')).toEqual({});
    expect(parseOwnedKeys(JSON.stringify(['a1']))).toEqual({});
    expect(parseOwnedKeys(null)).toEqual({});
  });

  it('lee las builds votadas e ignora lo dañado', () => {
    expect(parseVotedIds(JSON.stringify(['a1', 'b2']))).toEqual(['a1', 'b2']);
    expect(parseVotedIds(JSON.stringify(['a1', 2, null]))).toEqual(['a1']);
    expect(parseVotedIds('{')).toEqual([]);
    expect(parseVotedIds(JSON.stringify({ a1: true }))).toEqual([]);
    expect(parseVotedIds(null)).toEqual([]);
  });

  it('ordena por votos y, con los mismos, de la más reciente a la más antigua', () => {
    const builds = [
      build('old', 2, '2026-11-01T10:00:00.000Z'),
      build('top', 5, '2026-10-01T10:00:00.000Z'),
      build('new', 2, '2026-11-20T10:00:00.000Z'),
      build('none', 0, '2026-11-22T10:00:00.000Z')
    ];
    expect(sortByVotes(builds).map(entry => entry.id)).toEqual(['top', 'new', 'old', 'none']);
    expect(builds.map(entry => entry.id)).toEqual(['old', 'top', 'new', 'none']);
  });

  it('se resume como una build guardada, con su fecha de publicación', () => {
    expect(toSavedBuild(build('a1', 3, '2026-11-20T10:00:00.000Z'))).toEqual({
      id: 'a1',
      name: 'Build a1',
      code: 'code',
      savedAt: '2026-11-20T10:00:00.000Z'
    });
  });
});
