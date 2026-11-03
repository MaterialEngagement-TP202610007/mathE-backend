jest.mock('../../../src/config/envs.js', () => ({
  envs: { CORS_ORIGIN: 'http://localhost:5173' },
}));
jest.mock('../../../src/config/swagger.js', () => ({ swaggerSpec: {} }));

import { Router } from 'express';
import { AddressInfo } from 'node:net';
import { Server } from '../../../src/presentation/server.js';

describe('Server CORS', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const routes = Router();
    routes.get('/api/ping', (_req, res) => {
      res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
      res.send('ok');
    });
    server = new Server({ port: 0, routes });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await server.start();
    const address = (server as unknown as { httpServer: { address(): AddressInfo } })
      .httpServer.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('exposes Content-Disposition so the export file name is readable cross-origin (HU-49)', async () => {
    const response = await fetch(`${baseUrl}/api/ping`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('access-control-expose-headers')).toContain('Content-Disposition');
  });
});
