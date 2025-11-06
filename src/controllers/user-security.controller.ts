import { RequestHandler } from 'express';
import { createJwt, cookieOptions } from '@/utils/jwt';
import { UserSecurity as UserSecurityInterface } from '@/models/user-security';

const login2faUserSecurity: RequestHandler = async (req, res) => {
  const userSecurity: UserSecurityInterface = res.locals.userSecurity;
  try {
    const userToken = createJwt({ id: userSecurity.user_id }, process.env.JWT_SECRET!, 1);
    res.cookie('token', userToken, cookieOptions(req));

    res.clearCookie('userSecurityToken', { path: '/' });

    res.status(200).json({ message: '2FA login successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const logoutUserSecurity: RequestHandler = async (_req, res) => {
  res.clearCookie('userSecurityToken', { path: '/' });
  res.status(200).json({ message: 'UserSecurity session ended successfully' });
  return;
};



const userSecurityController = {
  login2faUserSecurity,
  logoutUserSecurity,
} satisfies Record<string, RequestHandler>;

export default userSecurityController;
