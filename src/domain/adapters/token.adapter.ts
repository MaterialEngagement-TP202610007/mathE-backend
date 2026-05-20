export interface TokenPayload {
  id: number;
  email: string;
  roleId: number | null;
}

export interface TokenAdapter {
  generate(payload: TokenPayload, duration?: string): Promise<string | null>;
  verify(token: string): Promise<TokenPayload | null>;
}
