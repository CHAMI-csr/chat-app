import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function signAccessToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return jwt.sign({}, secret, { subject: userId, expiresIn: '15m', issuer: 'chaty-api', audience: 'chaty-desktop' });
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    const payload = jwt.verify(token, secret, { issuer: 'chaty-api', audience: 'chaty-desktop' });
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token');
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
