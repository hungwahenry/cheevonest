interface TransformInput {
  value: unknown;
}

export const lowercaseTrim = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export const toNumber = ({ value }: TransformInput): unknown =>
  value === '' || value === null || value === undefined ? value : Number(value);

export const toBoolean = ({ value }: TransformInput): unknown => {
  if (value === undefined || typeof value === 'boolean') {
    return value;
  }

  return ['1', 'true', 'on', 'yes', 1, true].includes(value as string | number);
};

export const toIntArray = ({ value }: TransformInput): unknown =>
  Array.isArray(value) ? value.map((item) => Number(item)) : value;
