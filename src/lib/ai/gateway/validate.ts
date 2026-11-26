import './server-only';

type JSONSchema = {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  additionalProperties?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

export class InvalidAIOutputError extends Error {
  readonly code = 'invalid_response';
  readonly retryable = true;

  constructor() {
    super('AI provider output did not match the required format.');
    this.name = 'InvalidAIOutputError';
  }
}

const ALLOWED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

function matchesSchema(value: unknown, schema: JSONSchema): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;

  if (schema.type !== undefined && !ALLOWED_TYPES.has(schema.type)) return false;
  if (schema.enum && !schema.enum.some((entry) => Object.is(entry, value))) return false;

  if (schema.type === undefined && !schema.enum) return false;

  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in record)) return false;
        }
      }
      if (schema.additionalProperties === false && schema.properties) {
        if (Object.keys(record).some((key) => !(key in schema.properties!))) return false;
      }
      if (schema.properties) {
        for (const [key, childSchema] of Object.entries(schema.properties)) {
          if (key in record && !matchesSchema(record[key], childSchema)) return false;
        }
      }
      return true;
    }
    case 'array': {
      if (!Array.isArray(value)) return false;
      if (schema.minItems !== undefined && value.length < schema.minItems) return false;
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return false;
      if (schema.items && value.some((entry) => !matchesSchema(entry, schema.items!))) return false;
      return true;
    }
    case 'string': {
      if (typeof value !== 'string') return false;
      if (schema.minLength !== undefined && value.length < schema.minLength) return false;
      if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
      return true;
    }
    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) return false;
      if (schema.minimum !== undefined && value < schema.minimum) return false;
      if (schema.maximum !== undefined && value > schema.maximum) return false;
      return true;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (schema.minimum !== undefined && value < schema.minimum) return false;
      if (schema.maximum !== undefined && value > schema.maximum) return false;
      return true;
    }
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return schema.enum ? true : false;
  }
}

/** Requires strict JSON for structured tasks; unshaped text tasks stay trimmed-only. */
export function validateAIOutput(content: string, schema?: Record<string, unknown>): string {
  if (typeof content !== 'string') throw new InvalidAIOutputError();
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 100_000) throw new InvalidAIOutputError();
  if (!schema) return trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new InvalidAIOutputError();
  }

  if (!matchesSchema(parsed, schema as JSONSchema)) throw new InvalidAIOutputError();
  return JSON.stringify(parsed);
}
