export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly page: number,
    readonly perPage: number,
    readonly total: number,
  ) {}

  get lastPage(): number {
    return Math.max(Math.ceil(this.total / this.perPage), 1);
  }
}
