// __tests__/user.middleware.test.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import * as expressValidator from 'express-validator';
import User from '@/models/user';
import * as UserMiddleware from '@/middlewares/user.middleware';

jest.mock('@/models/user');
jest.mock('bcrypt');
jest.mock('express-validator');

const mockBody = expressValidator.body as jest.Mock;
const mockValidationResult = expressValidator.validationResult as unknown as jest.Mock;

const makeValidatorChain = () => {
  const chain: any = {
    exists: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    bail: jest.fn().mockReturnThis(),
    isEmail: jest.fn().mockReturnThis(),
    normalizeEmail: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    isStrongPassword: jest.fn().mockReturnThis(),
    isString: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    run: jest.fn().mockResolvedValue(undefined),
  };
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBody.mockImplementation(() => makeValidatorChain());
});

function makeReq(body = {}): Request {
  return { body } as any;
}

function makeRes(): Response {
  const res: any = { locals: {} };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next = jest.fn() as NextFunction;

describe('Middleware de usuario', () => {
  describe('EmailValid (validateRegister[0])', () => {
    const mw = UserMiddleware.validateRegister[0];
    it('Debe llamar a next tras validar email', async () => {
      const req = makeReq(),
        res = makeRes();
      await mw(req, res, next);
      expect(mockBody).toHaveBeenCalledWith('email');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('PasswordValid (validateRegister[1])', () => {
    const mw = UserMiddleware.validateRegister[1];
    it('Debe llamar a next tras validar contraseña', async () => {
      const req = makeReq(),
        res = makeRes();
      await mw(req, res, next);
      expect(mockBody).toHaveBeenCalledWith('user_password');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('CheckErrors (validateRegister[2])', () => {
    const mw = UserMiddleware.validateRegister[2];
    it('Debe llamar a next si no hay errores', () => {
      mockValidationResult.mockReturnValue({ isEmpty: () => true } as any);
      const req = makeReq(),
        res = makeRes();
      mw(req, res, next);
      expect(mockValidationResult).toHaveBeenCalledWith(req);
      expect(next).toHaveBeenCalled();
    });

    it('Debe responder 400 si hay errores', () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'err' }],
      } as any);
      const req = makeReq(),
        res = makeRes();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: ['err'] });
    });
  });

  describe('IsEmailTaken (validateRegister[3])', () => {
    const mw = UserMiddleware.validateRegister[3];

    it('Debe llamar a next si el email no está en uso', async () => {
      (User.isEmailTaken as jest.Mock).mockResolvedValue(false);
      const req = makeReq({ email: 'a@b.com' }),
        res = makeRes();
      await mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('Debe responder 400 si el email ya existe', async () => {
      (User.isEmailTaken as jest.Mock).mockResolvedValue(true);
      const req = makeReq({ email: 'a@b.com' }),
        res = makeRes();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email is already in use' });
    });

    it('Debe responder 500 en caso de error interno', async () => {
      (User.isEmailTaken as jest.Mock).mockRejectedValue(new Error());
      const req = makeReq({ email: 'x' }),
        res = makeRes();
      console.error = jest.fn();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });
  });

  const mockGetByEmail = User.getByEmail as jest.Mock;
  const mockCompare = bcrypt.compare as jest.Mock;

  describe('CurrentPasswordValid (validateLogin[1])', () => {
    const mw = UserMiddleware.validateLogin[1];
    it('Debe llamar a next tras validar contraseña actual', async () => {
      const req = makeReq(),
        res = makeRes();
      await mw(req, res, next);
      expect(mockBody).toHaveBeenCalledWith('user_password');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('ValidSensitiveData (validateUpdate[3])', () => {
    const mw = UserMiddleware.validateUpdate[3];
    it('Debe llamar a next tras validar todos los campos opcionales', async () => {
      const req = makeReq({
        first_name: 'AB',
        last_name: 'CD',
        address: 'Calle 12345',
        phone: '123456789',
      });
      const res = makeRes();
      await mw(req, res, next);
      expect(mockBody).toHaveBeenCalledWith('first_name');
      expect(mockBody).toHaveBeenCalledWith('last_name');
      expect(mockBody).toHaveBeenCalledWith('address');
      expect(mockBody).toHaveBeenCalledWith('phone');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('IsPasswordCorrect (validateLogin[3])', () => {
    const mw = UserMiddleware.validateLogin[3];
    it('Debe llamar a next si la contraseña coincide', async () => {
      const db = [{ user_password: 'hash', id: 9 }];
      mockGetByEmail.mockResolvedValue(db);
      mockCompare.mockResolvedValue(true);
      const req = makeReq({ email: 'u@e.com', user_password: 'pw' }),
        res = makeRes();
      await mw(req, res, next);
      expect(res.locals).toEqual(db[0]);
      expect(next).toHaveBeenCalled();
    });

    it('Debe responder 404 si no existe usuario', async () => {
      mockGetByEmail.mockResolvedValue([]);
      const req = makeReq({ email: 'u@e.com', user_password: 'pw' }),
        res = makeRes();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('Debe responder 400 si la contraseña es incorrecta', async () => {
      mockGetByEmail.mockResolvedValue([{ user_password: 'hash' }]);
      mockCompare.mockResolvedValue(false);
      const req = makeReq({ email: 'u@e.com', user_password: 'pw' }),
        res = makeRes();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Incorrect password' });
    });

    it('Debe responder 500 en caso de excepción', async () => {
      mockGetByEmail.mockRejectedValue(new Error('fail'));
      const req = makeReq({ email: 'u@e.com', user_password: 'pw' }),
        res = makeRes();
      console.error = jest.fn();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });
  });

  describe('GetUserByEmail (validateForgotPasswordEmail[2])', () => {
    const mw = UserMiddleware.validateForgotPasswordEmail[2];
    it('Debe llamar a next si el usuario existe', async () => {
      const user = { id: 7, email: 'x@x.com' };
      mockGetByEmail.mockResolvedValue([user]);
      const req = makeReq({ email: 'x@x.com' }),
        res = makeRes();
      await mw(req, res, next);
      expect(res.locals.user).toEqual(user);
      expect(next).toHaveBeenCalled();
    });

    it('Debe responder 404 si el usuario no existe', async () => {
      mockGetByEmail.mockResolvedValue([]);
      const req = makeReq({ email: 'x@x.com' }),
        res = makeRes();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('Debe responder 500 en caso de excepción', async () => {
      mockGetByEmail.mockRejectedValue(new Error('fail'));
      const req = makeReq({ email: 'x@x.com' }),
        res = makeRes();
      console.error = jest.fn();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });
  });
});
