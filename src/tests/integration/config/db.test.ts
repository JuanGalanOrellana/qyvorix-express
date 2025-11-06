import { initPool, connection, queryInsertion, queryRows } from '@/config/db';

beforeAll(async () => {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    decimalNumbers: true,
  };

  initPool(config);

  const conn = await connection();
  await conn.query(`
    CREATE TABLE IF NOT EXISTS test_table (
      id INT AUTO_INCREMENT PRIMARY KEY,
      test_name VARCHAR(255) NOT NULL
    )
  `);
  conn.release();
});

describe('Conexión a la base de datos', () => {
  it('Debería conectar a la base de datos', async () => {
    const conn = await connection();
    expect(conn).toBeTruthy();
  });
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
    expect(result.affectedRows).toBe(1);
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
