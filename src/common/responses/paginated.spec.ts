import { describe, expect, it } from 'vitest';
import { Paginated } from './paginated';

describe('Paginated', () => {
  it('computes last_page like Laravel LengthAwarePaginator', () => {
    expect(new Paginated([], 1, 20, 0).lastPage).toBe(1);
    expect(new Paginated([], 1, 20, 41).lastPage).toBe(3);
    expect(new Paginated([], 2, 20, 40).lastPage).toBe(2);
  });
});
