import jwt from 'jsonwebtoken';
import { setJwt } from '@/utils/jwt';
import { serialize } from 'cookie';

jest.mock('jsonwebtoken');
jest.mock('cookie');

const mockedSign = jwt.sign as jest.Mock;
const mockedSerialize = serialize as jest.Mock;

describe('setJwt', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Usa configuración de desarrollo (lax, no httpOnly, no secure)', () => {
    process.env.NODE_ENV = 'development';
    mockedSign.mockReturnValue('devToken');
    mockedSerialize.mockReturnValue('devCookieString');

    const result = setJwt('auth', { userId: 42 }, 'devSecret', 2);

    expect(mockedSign).toHaveBeenCalledWith({ userId: 42 }, 'devSecret', { expiresIn: '2h' });

    expect(mockedSerialize).toHaveBeenCalledWith('auth', 'devToken', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 2 * 3600,
      path: '/',
    });

    expect(result).toBe('devCookieString');
  });

  it('Usa configuración de producción (none, httpOnly y secure)', () => {
    process.env.NODE_ENV = 'production';
    mockedSign.mockReturnValue('prodToken');
    mockedSerialize.mockReturnValue('prodCookieString');

    const result = setJwt('session', { role: 'user2fa' }, 'prodSecret', 4);

    expect(mockedSign).toHaveBeenCalledWith({ role: 'user2fa' }, 'prodSecret', { expiresIn: '4h' });

    expect(mockedSerialize).toHaveBeenCalledWith('session', 'prodToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 4 * 3600,
      path: '/',
    });

    expect(result).toBe('prodCookieString');
  });
});
