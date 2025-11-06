import { Request, Response, NextFunction } from 'express';
import {
  hasJwtSecret,
  validateCookieToken,
  verifyToken,
  verifyResetToken,
} from '@/middlewares/jwt.middleware';
import { cookie, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '@/models/user';

jest.mock('express-validator', () => ({
  cookie: jest.fn(),
  validationResult: jest.fn(),
}));
jest.mock('jsonwebtoken');
jest.mock('@/models/user');

const mockCookie = cookie as jest.MockedFunction<typeof cookie>;
const mockValidationResult = validationResult as jest.MockedFunction<typeof validationResult>;
const mockJwtVerify = jwt.verify as jest.Mock;
const mockGetById = User.getById as jest.MockedFunction<typeof User.getById>;

function makeReq(cookies = {}) {
  return { cookies } as Request;
}
function makeRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res as Response);
  res.json = jest.fn().mockReturnValue(res as Response);
  res.locals = {};
  return res as Response;
}
const next = jest.fn() as NextFunction;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'secret';
});

describe('hasJwtSecret', () => {
  it('Calls next when JWT_SECRET is set', () => {
    const req = makeReq(),
      res = makeRes();
    hasJwtSecret(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('Returns 500 when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    const req = makeReq(),
      res = makeRes();
    hasJwtSecret(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('ValidateCookieToken', () => {
  const chain = {
    exists: jest.fn().mockReturnThis(),
    isJWT: jest.fn().mockReturnThis(),
    run: jest.fn(),
  };
  beforeEach(() => {
    mockCookie.mockReturnValue(chain as any);
  });

  it('On valid token sets res.locals and calls next', async () => {
    chain.run.mockResolvedValueOnce(undefined);
    mockValidationResult.mockReturnValueOnce({ isEmpty: () => true } as any);
    const mw = validateCookieToken('token', 'tokenKey');
    const req = makeReq({ token: 'jwt' }),
      res = makeRes();
    await mw(req, res, next);
    expect(chain.exists).toHaveBeenCalled();
    expect(chain.isJWT).toHaveBeenCalled();
    expect(res.locals.tokenKey).toBe('jwt');
    expect(next).toHaveBeenCalled();
  });

  it('On validation error returns 401', async () => {
    chain.run.mockResolvedValueOnce(undefined);
    mockValidationResult.mockReturnValueOnce({ isEmpty: () => false } as any);
    const mw = validateCookieToken('tok', 'key');
    const req = makeReq({ tok: 'bad' }),
      res = makeRes();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not Authorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('On exception returns 500', async () => {
    chain.run.mockRejectedValueOnce(new Error('fail'));
    const mw = validateCookieToken('tok', 'key');
    const req = makeReq(),
      res = makeRes();
    console.error = jest.fn();
    await mw(req, res, next);
    expect(console.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });
});

describe('verifyToken', () => {
  it('On valid token and existing user attaches user and calls next', async () => {
    mockJwtVerify.mockReturnValue({ id: 7 } as any);
    mockGetById.mockResolvedValueOnce([{ id: 7, email: 'x' } as any]);
    const req = makeReq(),
      res = makeRes();
    res.locals.token = 'jwt';
    await verifyToken(req, res, next);
    expect(mockJwtVerify).toHaveBeenCalledWith('jwt', 'secret');
    expect(res.locals.user).toEqual({ id: 7, email: 'x' });
    expect(next).toHaveBeenCalled();
  });

  it('When user not found returns 404', async () => {
    mockJwtVerify.mockReturnValue({ id: 8 } as any);
    mockGetById.mockResolvedValueOnce([]);
    const req = makeReq(),
      res = makeRes();
    res.locals.token = 'jwt';
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('On verify error returns 401', async () => {
    mockJwtVerify.mockImplementation(() => {
      throw new Error();
    });
    const req = makeReq(),
      res = makeRes();
    res.locals.token = 'bad';
    console.log = jest.fn();
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not Authorized' });
  });
});

describe('verifyResetToken', () => {
  it('On valid token and existing user attaches id and calls next', async () => {
    mockJwtVerify.mockReturnValue({ id: 3 } as any);
    mockGetById.mockResolvedValueOnce([{ id: 3 } as any]);
    const req = makeReq(),
      res = makeRes();
    res.locals.resetToken = 'rt';
    await verifyResetToken(req, res, next);
    expect(res.locals.id).toBe(3);
    expect(next).toHaveBeenCalled();
  });

  it('When user not found returns 404', async () => {
    mockJwtVerify.mockReturnValue({ id: 4 } as any);
    mockGetById.mockResolvedValueOnce([]);
    const req = makeReq(),
      res = makeRes();
    res.locals.resetToken = 'rt';
    await verifyResetToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('On verify error returns 401', async () => {
    mockJwtVerify.mockImplementation(() => {
      throw new Error();
    });
    const req = makeReq(),
      res = makeRes();
    res.locals.resetToken = 'bad';
    console.log = jest.fn();
    await verifyResetToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not Authorized' });
  });
});
