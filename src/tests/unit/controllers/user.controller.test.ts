import controller from '@/controllers/user.controller';
import User from '@/models/user';
import { setJwt } from '@/utils/jwt';
import { Request, Response } from 'express';

jest.mock('@/models/user');
jest.mock('@/utils/jwt');

const mockCreateUser = User.createUser as jest.Mock;
const mockGetById = User.getById as jest.Mock;
const mockGetByEmail = User.getByEmail as jest.Mock;
const mockVerifyEmail = User.verifyEmail as jest.Mock;
const mockChangePassword = User.changePassword as jest.Mock;
const mockUpdateUserData = User.updateUserData as jest.Mock;
const mockSetJwt = setJwt as jest.Mock;

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'secret';
  });

  it('Register → 201 + Set-Cookie', async () => {
    mockCreateUser.mockResolvedValue({ insertId: 1 });
    mockSetJwt.mockReturnValue('cookie=jwt');
    const req = {
      body: { email: 'a@b.com', user_password: 'p', first_name: 'A', last_name: 'B' },
    } as Request;
    const res = mockRes();
    await controller.register(req, res);
    expect(mockCreateUser).toHaveBeenCalledWith(req.body);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', 'cookie=jwt');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'User registered successfully' });
  });

  it('Register → 500 on createUser error', async () => {
    mockCreateUser.mockRejectedValue(new Error());
    const req = { body: {} } as Request;
    const res = mockRes();
    console.error = jest.fn();
    await controller.register(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('Login → 200 + Set-Cookie', async () => {
    mockSetJwt.mockReturnValue('cookie=jwt');
    const req = {} as Request;
    const res = mockRes();
    res.locals = { id: 2 };
    await controller.login(req, res);
    expect(mockSetJwt).toHaveBeenCalledWith('token', { id: 2 }, 'secret', 1);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Login successful' });
  });

  it('Login → 500 on setJwt error', async () => {
    mockSetJwt.mockImplementation(() => {
      throw new Error();
    });
    const req = {} as Request;
    const res = mockRes();
    res.locals = { id: 1 };
    console.error = jest.fn();
    await controller.login(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('Logout → 200 + clearCookie', async () => {
    const req = {} as Request;
    const res = mockRes();
    await controller.logout(req, res);
    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Session ended successfully' });
  });

  it('GetUserData → 404 if not found', async () => {
    mockGetById.mockResolvedValue([]);
    const req = {} as Request;
    const res = mockRes();
    res.locals = { id: 3 };
    await controller.getUserData(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('GetUserData → 200 + data', async () => {
    const user = { id: 3, email: 'x' } as any;
    mockGetById.mockResolvedValue([user]);
    const req = {} as Request;
    const res = mockRes();
    res.locals = { id: 3 };
    await controller.getUserData(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User data obtained successfully',
      data: user,
    });
  });

  it('GetUserData → 500 on getById error', async () => {
    mockGetById.mockRejectedValue(new Error());
    const req = {} as Request;
    const res = mockRes();
    res.locals = { id: 2 };
    console.error = jest.fn();
    await controller.getUserData(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('EmailVerification → 404 if none', async () => {
    mockVerifyEmail.mockResolvedValue({ affectedRows: 0 });
    const req = {} as Request;
    const res = mockRes();
    res.locals = { user: { email: 'no@e.com' } };
    await controller.emailVerification(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email not found' });
  });

  it('EmailVerification → 200 if ok', async () => {
    mockVerifyEmail.mockResolvedValue({ affectedRows: 1 });
    const req = {} as Request;
    const res = mockRes();
    res.locals = { user: { email: 'ok@e.com' } };
    await controller.emailVerification(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email verified successfully' });
  });

  it('EmailVerification → 500 on verifyEmail error', async () => {
    mockVerifyEmail.mockRejectedValue(new Error());
    const req = {} as Request;
    const res = mockRes();
    res.locals = { user: { email: 'x@e.com' } };
    console.error = jest.fn();
    await controller.emailVerification(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });
  it('ForgotPasswordEmail → 404 if email not found', async () => {
    mockGetByEmail.mockResolvedValue([]);
    const req = { body: { email: 'none@e.com' } } as Request;
    const res = mockRes();
    await controller.forgotPasswordEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email not found' });
  });

  it('ForgotPasswordEmail → 200 + Set-Cookie', async () => {
    const u = { id: 5 };
    mockGetByEmail.mockResolvedValue([u] as any);
    mockSetJwt.mockReturnValue('cookie=rt');
    const req = { body: { email: 'yes@e.com' } } as Request;
    const res = mockRes();
    await controller.forgotPasswordEmail(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', 'cookie=rt');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email sent successfully' });
  });

  it('ForgotPasswordEmail → 500 on getByEmail error', async () => {
    mockGetByEmail.mockRejectedValue(new Error());
    const req = { body: { email: 'x@e.com' } } as Request;
    const res = mockRes();
    console.error = jest.fn();
    await controller.forgotPasswordEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('ResetPassword → 404 if no user', async () => {
    mockChangePassword.mockResolvedValue({ affectedRows: 0 });
    const req = { body: { user_password: 'new' } } as Request;
    const res = mockRes();
    res.locals = { id: 9 };
    await controller.resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('ResetPassword → 200 if ok', async () => {
    mockChangePassword.mockResolvedValue({ affectedRows: 1 });
    const req = { body: { user_password: 'new' } } as Request;
    const res = mockRes();
    res.locals = { id: 9 };
    await controller.resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
  });

  it('ResetPassword → 401 on changePassword error', async () => {
    mockChangePassword.mockRejectedValue(new Error());
    const req = { body: { user_password: 'p' } } as Request;
    const res = mockRes();
    res.locals = { id: 3 };
    console.error = jest.fn();
    await controller.resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not Valid Token' });
  });

  it('UpdateUserData → 404 if none', async () => {
    mockUpdateUserData.mockResolvedValue(null);
    const req = { body: {} } as Request;
    const res = mockRes();
    res.locals = { user: { id: 7 } };
    await controller.updateUserData(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('UpdateUserData → 200 if ok', async () => {
    mockUpdateUserData.mockResolvedValue({ affectedRows: 1 });
    const req = { body: { first_name: 'Z' } } as Request;
    const res = mockRes();
    res.locals = { user: { id: 7 } };
    await controller.updateUserData(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'User data updated successfully' });
  });

  it('UpdateUserData → 500 on updateUserData error', async () => {
    mockUpdateUserData.mockRejectedValue(new Error());
    const req = { body: { first_name: 'Z' } } as Request;
    const res = mockRes();
    res.locals = { user: { id: 4 } };
    console.error = jest.fn();
    await controller.updateUserData(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('SendVerificationEmail → 200 y mensaje correcto en caso de éxito', async () => {
    const req = {} as Request;
    const res = mockRes();

    await controller.sendVerificationEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email sent successfully' });
  });

  it('SendVerificationEmail → 500 y mensaje de error si lanza excepción', async () => {
    const req = {} as Request;
    const res: any = {};
    // hacemos que res.status lance la primera vez para disparar el catch
    res.status = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('oops');
      })
      .mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    console.error = jest.fn();

    await controller.sendVerificationEmail(req, res);

    expect(console.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });
});
