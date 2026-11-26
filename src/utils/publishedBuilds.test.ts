import { describe, expect, it } from 'vitest';
import { getOwnPublishedCodes, getPublishedBuildUrl, isYamlBuildCode, parseOwnedKeys, parseReportedIds, parseVotedIds, sortByVotes, toSavedBuild, type PublishedBuild } from './publishedBuilds';

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

  it('lee las builds denunciadas e ignora lo dañado', () => {
    expect(parseReportedIds(JSON.stringify(['a1', 'b2']))).toEqual(['a1', 'b2']);
    expect(parseReportedIds(JSON.stringify(['a1', 7]))).toEqual(['a1']);
    expect(parseReportedIds('not json')).toEqual([]);
    expect(parseReportedIds(null)).toEqual([]);
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

  it('sabe qué códigos se publicaron desde este navegador', () => {
    const builds = [
      { ...build('mine', 0, '2026-11-20T10:00:00.000Z'), code: 'code-a' },
      { ...build('theirs', 0, '2026-11-21T10:00:00.000Z'), code: 'code-b' },
      { ...build('copy', 0, '2026-11-22T10:00:00.000Z'), code: 'code-a' }
    ];
    expect([...getOwnPublishedCodes(builds, { mine: 'key' })]).toEqual(['code-a']);
    expect([...getOwnPublishedCodes(builds, {})]).toEqual([]);
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

// Las builds del MechLab de YAML en la página de builds de MW5 (docs/specs/publicar-builds-yaml.md).
describe('builds publicadas de YAML', () => {
  it('CA5: un código es de YAML si empieza por Y1.', () => {
    expect(isYamlBuildCode('Y1.eyJtIjoiQ1RGLTFYIn0')).toBe(true);
    expect(isYamlBuildCode('WzEsIkFTNy1EIl0')).toBe(false);
    expect(isYamlBuildCode('Y2.eyJtIjoiQ1RGLTFYIn0')).toBe(false);
    expect(isYamlBuildCode('')).toBe(false);
  });

  it('CA6: el enlace de una build de YAML abre el MechLab de YAML y el de MW5, el de MW5', () => {
    expect(getPublishedBuildUrl('Y1.abc', 'https://mw-builder.com')).toBe('https://mw-builder.com/mercs/yaml/?b=Y1.abc');
    expect(getPublishedBuildUrl('WzEsIkFTNy1EIl0', 'https://mw-builder.com')).toBe('https://mw-builder.com/mercs/?b=WzEsIkFTNy1EIl0');
  });
});
