import { initPool, queryInsertion, queryRows } from '@/config/db';

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    getConnection: jest.fn().mockResolvedValue({
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.startsWith('INSERT')) {
          return Promise.resolve([{ affectedRows: 2 }, []]);
        } else {
          return Promise.resolve([[{ solution: 2 }], []]);
        }
      }),
      release: jest.fn(),
    }),
  })),
}));

beforeAll(() => {
  const { createPool } = require('mysql2/promise');
  initPool(createPool({}));
});

describe('Consultas a la base de datos', () => {
  it('Debería ejecutar una consulta', async () => {
    const result = await queryRows('SELECT 1 + 1 AS solution');
    expect(result).toBeDefined();
    expect(result[0].solution).toBe(2);
  });

  it('Debería lanzar un error si no le pasamos una consulta SQL', async () => {
    await expect(queryRows('')).rejects.toThrow('SQL query is required');
  });

  it('Debería lanzar un error si los parámetros no son un array', async () => {
    await expect(
      queryRows('SELECT * FROM test_table WHERE id = ?', { id: 1 } as any)
    ).rejects.toThrow('Parameters must be an array');
  });
});

describe('Inserciones en la base de datos', () => {
  it('Debería insertar una fila', async () => {
    const result = await queryInsertion('INSERT INTO test_table (test_name) VALUES (?)', ['test']);
    expect(result.affectedRows).toBe(2);
  });

  it('Debería lanzar un error si no le pasamos una consulta SQL para inserción', async () => {
    await expect(queryInsertion('')).rejects.toThrow('SQL query is required');
  });

  it('Debería lanzar un error si los parámetros no son un array', async () => {
    await expect(
      queryInsertion('INSERT INTO test_table (test_name) VALUES (?)', { test_name: 'test' } as any)
    ).rejects.toThrow('Parameters must be an array');
  });
});
