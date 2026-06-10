import { ValidationError } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validationExceptionFactory } from './validation-exception.factory';

describe('validationExceptionFactory', () => {
  it('flattens nested validation errors into a Laravel-style field map', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
        children: [],
      },
      {
        property: 'items',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'ticket_id',
                constraints: { isString: 'ticket_id must be a string' },
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const exception = validationExceptionFactory(errors);

    expect(exception.status).toBe(422);
    expect(exception.code).toBe('validation_failed');
    expect(exception.message).toBe('The given data was invalid.');
    expect(exception.errors).toEqual({
      email: ['email must be an email'],
      'items.0.ticket_id': ['ticket_id must be a string'],
    });
  });
});
