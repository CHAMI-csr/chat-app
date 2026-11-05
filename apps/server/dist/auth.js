"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.authenticate = authenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function signAccessToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32)
        throw new Error('JWT_SECRET must contain at least 32 characters');
    return jsonwebtoken_1.default.sign({}, secret, { subject: userId, expiresIn: '15m', issuer: 'chaty-api', audience: 'chaty-desktop' });
}
function authenticate(req, res, next) {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ error: 'Authentication required' });
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw new Error('JWT_SECRET is not configured');
        const payload = jsonwebtoken_1.default.verify(token, secret, { issuer: 'chaty-api', audience: 'chaty-desktop' });
        if (typeof payload === 'string' || !payload.sub)
            throw new Error('Invalid token');
        req.userId = payload.sub;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired access token' });
    }
}
