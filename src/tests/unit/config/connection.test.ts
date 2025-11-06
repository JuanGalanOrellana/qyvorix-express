import { connection, initPool } from '@/config/db';
import { createPool } from 'mysql2/promise';

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(),
}));

describe('connection()', () => {
  afterEach(() => {
    // @ts-expect-error: queremos forzar el pool como undefined
    initPool(undefined);
    jest.clearAllMocks();
  });

  it('Debería lanzar error si pool no está inicializada', async () => {
    // No llamamos a initPool
    await expect(connection()).rejects.toThrow('Database connection pool is not initialized');
  });

  it('Debería lanzar error si getConnection lanza excepción', async () => {
    const mockPool = {
      getConnection: jest.fn().mockRejectedValue(new Error('Fallo inesperado')),
    };
    (createPool as jest.Mock).mockReturnValue(mockPool);
    initPool({}); // da igual el objeto, será interceptado

    await expect(connection()).rejects.toThrow('Database connection error');
  });

  it('Debería devolver la conexión si todo va bien', async () => {
    const mockConn = {
      query: jest.fn(),
      release: jest.fn(),
    };
    const mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConn),
    };
    (createPool as jest.Mock).mockReturnValue(mockPool);
    initPool({});

    const conn = await connection();
    expect(conn).toBe(mockConn);
  });
});
