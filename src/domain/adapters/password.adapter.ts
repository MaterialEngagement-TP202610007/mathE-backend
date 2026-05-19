export interface PasswordAdapter {
  hash(password: string): string;
  compare(password: string, hashed: string): boolean;
}
