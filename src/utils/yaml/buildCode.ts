import type { YamlBuild } from '../../types/yaml-mechlab';

// Código de una build de YAML para los enlaces. Lleva su propio prefijo para que un código del MechLab
// de MW5 (otras reglas, otras piezas) no se abra aquí por error.
const PREFIX = 'Y1.';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

// Sin rasgos, el código no lleva el campo: los enlaces de antes de los rasgos siguen siendo los mismos.
export function encodeYamlBuild(mechId: string, build: YamlBuild): string {
  const { traits, ...rest } = build;
  return PREFIX + toBase64Url(JSON.stringify({ m: mechId, b: traits?.length ? { ...rest, traits } : rest }));
}

function isBuild(value: unknown): value is YamlBuild {
  const build = value as YamlBuild;
  return !!build && typeof build === 'object' && typeof build.internal === 'object'
    && Array.isArray(build.items) && Array.isArray(build.weapons) && typeof build.armor === 'object'
    && (build.traits === undefined || (Array.isArray(build.traits) && build.traits.every(id => typeof id === 'string')));
}

export function decodeYamlBuild(code: string): { mechId: string; build: YamlBuild } | null {
  if (!code.startsWith(PREFIX)) return null;
  try {
    const data = JSON.parse(fromBase64Url(code.slice(PREFIX.length))) as { m?: unknown; b?: unknown };
    return typeof data.m === 'string' && isBuild(data.b) ? { mechId: data.m, build: data.b } : null;
  } catch {
    return null;
  }
}
