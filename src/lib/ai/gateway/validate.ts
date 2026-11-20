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

function matchesSchema(value: unknown, schema: JSONSchema): boolean {
  if (schema.enum && !schema.enum.some((entry) => Object.is(entry, value))) return false;

  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      if (schema.required?.some((key) => !(key in record))) return false;
      if (schema.additionalProperties === false && schema.properties) {
        if (Object.keys(record).some((key) => !(key in schema.properties!))) return false;
      }
      return Object.entries(schema.properties ?? {}).every(([key, propertySchema]) =>
        !(key in record) || matchesSchema(record[key], propertySchema),
      );
    }
    case 'array':
      return Array.isArray(value) &&
        (schema.minItems === undefined || value.length >= schema.minItems) &&
        (schema.maxItems === undefined || value.length <= schema.maxItems) &&
        (!schema.items || value.every((item) => matchesSchema(item, schema.items!)));
    case 'string':
      return typeof value === 'string' &&
        (schema.minLength === undefined || value.length >= schema.minLength) &&
        (schema.maxLength === undefined || value.length <= schema.maxLength);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value) &&
        (schema.minimum === undefined || value >= schema.minimum) &&
        (schema.maximum === undefined || value <= schema.maximum);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) &&
        (schema.minimum === undefined || value >= schema.minimum) &&
        (schema.maximum === undefined || value <= schema.maximum);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

/** Validates only the JSON Schema subset used by server-owned task contracts. */
export function validateAIOutput(content: string, schema?: Record<string, unknown>): string {
  const trimmed = content.trim();
  if (!trimmed) throw new InvalidAIOutputError();
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
