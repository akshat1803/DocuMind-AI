import { describe, expect, it } from 'vitest';
import { LoginInputSchema, RegisterInputSchema } from './index.js';

describe('shared authentication schemas', () => {
  it('accepts valid registration input', () => {
    expect(RegisterInputSchema.safeParse({ name: 'Akshay', email: 'a@example.com', password: 'secret12' }).success).toBe(true);
  });

  it('rejects malformed authentication input', () => {
    expect(RegisterInputSchema.safeParse({ name: 'A', email: 'invalid', password: '123' }).success).toBe(false);
    expect(LoginInputSchema.safeParse({ email: 'invalid', password: '' }).success).toBe(false);
  });
});
