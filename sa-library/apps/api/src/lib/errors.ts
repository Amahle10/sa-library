export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function required<T>(value: T | null | undefined, name = 'Record'): T {
  if (value == null) throw new AppError(404, 'NOT_FOUND', `${name} not found.`);
  return value;
}
export function conflict(message: string, code = 'CONFLICT'): never {
  throw new AppError(409, code, message);
}
