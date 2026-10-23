import { describe, expect, it } from 'vitest';
import { CHANGELOG } from './changelog';

describe('novedades', () => {
  it('tienen ids únicos y van de la más reciente a la más antigua', () => {
    expect(new Set(CHANGELOG.map(entry => entry.id)).size).toBe(CHANGELOG.length);
    const dates = CHANGELOG.map(entry => entry.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(CHANGELOG.every(entry => !Number.isNaN(Date.parse(entry.date)) && entry.items.length > 0)).toBe(true);
  });

  it('no usan rayas en los textos', () => {
    expect(CHANGELOG.flatMap(entry => [entry.title, ...entry.items]).filter(text => /—|--/.test(text))).toEqual([]);
  });
});
