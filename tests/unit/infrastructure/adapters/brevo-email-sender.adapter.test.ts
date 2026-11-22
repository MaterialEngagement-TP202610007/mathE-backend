jest.mock('../../../../src/config/envs.js', () => ({
  envs: {
    BREVO_API_KEY: 'brevo-key',
    EMAIL_FROM_ADDRESS: 'mathe.app@gmail.com',
    EMAIL_FROM_NAME: 'MathE',
    EMAIL_TIMEOUT_MS: 10000,
  },
}));

import { BrevoEmailSenderAdapterImpl } from '../../../../src/infrastructure/adapters/brevo-email-sender.adapter.impl.js';

const email = { to: 'ana@example.com', name: 'Ana Pérez', code: '042917', expiresInMinutes: 15 };

describe('BrevoEmailSenderAdapterImpl', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the code to the Brevo transactional API with the api-key header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ messageId: '<id>' }), { status: 201 }));

    await new BrevoEmailSenderAdapterImpl().sendVerificationCode(email);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('brevo-key');
    const body = JSON.parse(init.body);
    expect(body.sender).toEqual({ email: 'mathe.app@gmail.com', name: 'MathE' });
    expect(body.to).toEqual([{ email: 'ana@example.com', name: 'Ana Pérez' }]);
    expect(body.subject).toContain('042917');
    expect(body.htmlContent).toContain('042917');
    expect(body.htmlContent).toContain('15 minutos');
  });

  it('escapes the user name in the HTML body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    await new BrevoEmailSenderAdapterImpl().sendVerificationCode({ ...email, name: '<b>Ana</b>' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.htmlContent).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(body.htmlContent).not.toContain('<b>Ana</b>');
  });

  it('turns a provider error into a 502 without leaking the API key', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 }),
    );
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const error = (await new BrevoEmailSenderAdapterImpl()
      .sendVerificationCode(email)
      .catch((e: unknown) => e)) as { statusCode: number; message: string };

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Email provider returned status 401');
    expect(JSON.stringify(log.mock.calls)).not.toContain('brevo-key');
    log.mockRestore();
  });
});
