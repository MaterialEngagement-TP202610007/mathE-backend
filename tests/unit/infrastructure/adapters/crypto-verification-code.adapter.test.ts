import { CryptoVerificationCodeAdapterImpl } from '../../../../src/infrastructure/adapters/crypto-verification-code.adapter.impl.js';

describe('CryptoVerificationCodeAdapterImpl', () => {
  const adapter = new CryptoVerificationCodeAdapterImpl('server-secret');

  it('generates 6-digit numeric codes, keeping leading zeros', () => {
    for (let i = 0; i < 200; i++) {
      expect(adapter.generate()).toMatch(/^\d{6}$/);
    }
  });

  it('hashes deterministically to 64 hex chars without containing the code', () => {
    const hash = adapter.hash('042917');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(adapter.hash('042917')).toBe(hash);
    expect(hash).not.toContain('042917');
  });

  it('depends on the server secret', () => {
    expect(new CryptoVerificationCodeAdapterImpl('other').hash('042917')).not.toBe(adapter.hash('042917'));
  });

  it('matches only the right code', () => {
    const hash = adapter.hash('042917');
    expect(adapter.matches('042917', hash)).toBe(true);
    expect(adapter.matches('042918', hash)).toBe(false);
    expect(adapter.matches('042917', 'not-a-hash')).toBe(false);
  });
});
