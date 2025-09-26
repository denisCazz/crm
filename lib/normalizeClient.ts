import { Client } from '../types';

type UnknownTags = Client['tags'] | string | string[] | null | undefined;

const cleanTag = (tag: unknown): string | null => {
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseDelimitedTags = (rawValue: string): string[] => {
  let value = rawValue.trim();

  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('(') && value.endsWith(')'))) {
    value = value.slice(1, -1);
  }

  return value
    .split(/[|,;\n]/)
    .map((part) => part.replace(/^"|"$/g, '').trim())
    .filter((part) => part.length > 0);
};

export const normalizeTags = (value: UnknownTags): string[] | null => {
  if (Array.isArray(value)) {
    const cleaned = value
      .map(cleanTag)
      .filter((tag): tag is string => tag !== null);
    return cleaned.length > 0 ? cleaned : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map(cleanTag)
          .filter((tag): tag is string => tag !== null);
        if (cleaned.length > 0) return cleaned;
        return null;
      }
    } catch {
      // Ignore JSON parse errors and continue with other strategies
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inside = trimmed.slice(1, -1);
      if (!inside) return null;

      const parts = inside
        .split(',')
        .map((part) => part.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim())
        .filter((part) => part.length > 0)
        .map(cleanTag)
        .filter((tag): tag is string => tag !== null);

      return parts.length > 0 ? parts : null;
    }

    const splitted = parseDelimitedTags(trimmed);
    return splitted.length > 0 ? splitted : null;
  }

  return null;
};

export const normalizeClient = (client: Client): Client => {
  const tags = normalizeTags(client.tags);
  return {
    ...client,
    tags,
  };
};
