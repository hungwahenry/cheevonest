import { ValidationError } from '@nestjs/common';
import { ValidationFailedException } from '../exceptions/api.exception';

export function validationExceptionFactory(
  validationErrors: ValidationError[],
): ValidationFailedException {
  const errors: Record<string, string[]> = {};

  const collect = (items: ValidationError[], parentPath?: string): void => {
    for (const item of items) {
      const path = parentPath
        ? `${parentPath}.${item.property}`
        : item.property;

      if (item.constraints) {
        errors[path] = Object.values(item.constraints);
      }

      if (item.children?.length) {
        collect(item.children, path);
      }
    }
  };

  collect(validationErrors);

  return new ValidationFailedException(errors);
}
