import bcrypt from 'bcrypt';
import { ResultSetHeader } from 'mysql2';
import User, { UserRegister, UserSensitiveData, UserResponse } from '@/models/user';
import { queryRows, queryInsertion } from '@/config/db';

jest.mock('bcrypt');
jest.mock('@/config/db', () => ({
  queryRows: jest.fn(),
  queryInsertion: jest.fn(),
}));

const mockQueryRows = queryRows as jest.MockedFunction<typeof queryRows>;
const mockQueryInsertion = queryInsertion as jest.MockedFunction<typeof queryInsertion>;
const mockGenSalt = bcrypt.genSaltSync as jest.MockedFunction<typeof bcrypt.genSaltSync>;
const mockHash = bcrypt.hashSync as jest.MockedFunction<typeof bcrypt.hashSync>;

describe('User', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByEmail', () => {
    it('Debe llamar a queryRows con el SQL y devolver el resultado', async () => {
      const fakeRows = [
        {
          id: 1,
          first_name: 'Juan',
          last_name: 'Pérez',
          email: 'juan@ej.com',
          user_password: 'hash',
          address: 'Calle Falsa 123',
          phone: '600600600',
          email_verified: false,
          register_time: '2025-07-01 12:00:00',
        },
      ] as UserResponse[];
      mockQueryRows.mockResolvedValueOnce(fakeRows);

      const result = await User.getByEmail('juan@ej.com');

      expect(mockQueryRows).toHaveBeenCalledWith('SELECT * FROM users WHERE email = ?', [
        'juan@ej.com',
      ]);
      expect(result).toBe(fakeRows);
    });
  });

  describe('getById', () => {
    it('Debe llamar a queryRows con el SQL y devolver el resultado', async () => {
      const fakeRows = [
        {
          id: 42,
          first_name: 'Ana',
          last_name: 'García',
          email: 'ana@ej.com',
          user_password: 'hash2',
          address: 'Av. Siempre Viva',
          phone: '699699699',
          email_verified: true,
          register_time: '2025-06-15 09:30:00',
        },
      ] as UserResponse[];
      mockQueryRows.mockResolvedValueOnce(fakeRows);

      const result = await User.getById(42);

      expect(mockQueryRows).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [42]);
      expect(result).toBe(fakeRows);
    });
  });

  describe('isEmailTaken', () => {
    it('Debe devolver false cuando no hay usuarios', async () => {
      mockQueryRows.mockResolvedValueOnce([]);
      const taken = await User.isEmailTaken('x@noexiste.com');
      expect(taken).toBe(false);
    });

    it('Debe devolver true cuando hay al menos un usuario', async () => {
      mockQueryRows.mockResolvedValueOnce([{} as UserResponse]);
      const taken = await User.isEmailTaken('x@existe.com');
      expect(taken).toBe(true);
    });
  });

  describe('createUser', () => {
    beforeEach(() => {
      mockGenSalt.mockReturnValue('fixedSalt');
      mockHash.mockReturnValue('fixedHash');
    });

    it('Inserta sin email_verified cuando no viene en el payload', async () => {
      const newUser: UserRegister = {
        first_name: 'Luis',
        last_name: 'Martínez',
        email: 'luis@ej.com',
        user_password: 'secreto',
      };
      const fakeHeader = { insertId: 7 } as ResultSetHeader;
      mockQueryInsertion.mockResolvedValueOnce(fakeHeader);

      const result = await User.createUser(newUser);

      expect(mockGenSalt).toHaveBeenCalledWith(10);
      expect(mockHash).toHaveBeenCalledWith('secreto', 'fixedSalt');
      expect(mockQueryInsertion).toHaveBeenCalledWith(
        'INSERT INTO users (first_name, last_name, email, user_password) VALUES (?, ?, ?, ?)',
        ['Luis', 'Martínez', 'luis@ej.com', 'fixedHash']
      );
      expect(result).toBe(fakeHeader);
    });

    it('Inserta con email_verified cuando viene a true', async () => {
      const newUser: UserRegister = {
        first_name: 'Marta',
        last_name: 'López',
        email: 'marta@ej.com',
        user_password: 'topsecret',
        email_verified: true,
      };
      const fakeHeader = { insertId: 8 } as ResultSetHeader;
      mockQueryInsertion.mockResolvedValueOnce(fakeHeader);

      const result = await User.createUser(newUser);

      expect(mockQueryInsertion).toHaveBeenCalledWith(
        'INSERT INTO users (first_name, last_name, email, user_password, email_verified) VALUES (?, ?, ?, ?, ?)',
        ['Marta', 'López', 'marta@ej.com', 'fixedHash', true]
      );
      expect(result).toBe(fakeHeader);
    });
  });

  describe('updateUserData', () => {
    it('Devuelve null y no llama a queryInsertion si no hay campos válidos', async () => {
      const res = await User.updateUserData(1, {});
      expect(res).toBeNull();
      expect(mockQueryInsertion).not.toHaveBeenCalled();
    });

    it('Construye la query correcta y llama a queryInsertion', async () => {
      const fakeHeader = { affectedRows: 1 } as ResultSetHeader;
      mockQueryInsertion.mockResolvedValueOnce(fakeHeader);

      const partial: Partial<UserSensitiveData> = {
        first_name: 'Elena',
        phone: '612345678',
      };
      const res = await User.updateUserData(3, partial);

      expect(mockQueryInsertion).toHaveBeenCalledWith(
        'UPDATE users SET first_name = ?, phone = ? WHERE id = ?',
        ['Elena', '612345678', 3]
      );
      expect(res).toBe(fakeHeader);
    });
  });

  describe('verifyEmail', () => {
    it('Llama a queryInsertion con la SQL correcta', async () => {
      const fakeHeader = { changedRows: 1 } as ResultSetHeader;
      mockQueryInsertion.mockResolvedValueOnce(fakeHeader);

      const res = await User.verifyEmail('alguien@ej.com');

      expect(mockQueryInsertion).toHaveBeenCalledWith(
        'UPDATE users SET email_verified = true WHERE email = ?',
        ['alguien@ej.com']
      );
      expect(res).toBe(fakeHeader);
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      mockGenSalt.mockReturnValue('salt2');
      mockHash.mockReturnValue('newHash');
    });

    it('Hashea la contraseña y llama a queryInsertion', async () => {
      const fakeHeader = { changedRows: 1 } as ResultSetHeader;
      mockQueryInsertion.mockResolvedValueOnce(fakeHeader);

      const res = await User.changePassword(99, 'nuevacontra');

      expect(mockGenSalt).toHaveBeenCalledWith(10);
      expect(mockHash).toHaveBeenCalledWith('nuevacontra', 'salt2');
      expect(mockQueryInsertion).toHaveBeenCalledWith(
        'UPDATE users SET user_password = ? WHERE id = ?',
        ['newHash', 99]
      );
      expect(res).toBe(fakeHeader);
    });
  });
});
