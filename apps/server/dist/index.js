"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_http_1 = require("node:http");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const argon2_1 = __importDefault(require("argon2"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const auth_1 = require("./auth");
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const httpServer = (0, node_http_1.createServer)(app);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const isAllowedOrigin = (origin) => clientOrigin === '*' || !origin || origin === 'null' || origin === 'file://' || origin === clientOrigin;
const fileStore = node_path_1.default.resolve(process.env.FILE_STORAGE_DIR ?? node_path_1.default.join(process.cwd(), '.data', 'files'));
(0, node_fs_1.mkdirSync)(fileStore, { recursive: true });
app.disable('x-powered-by');
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin)), credentials: true }));
app.use(express_1.default.json({ limit: '32kb' }));
app.use('/api/auth', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: (origin, callback) => callback(null, isAllowedOrigin(origin)), methods: ['GET', 'POST'] },
    maxHttpBufferSize: 100_000,
});
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
    displayName: zod_1.z.string().trim().min(1).max(80),
    email: zod_1.z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    password: zod_1.z.string().min(10).max(128),
});
const loginSchema = zod_1.z.object({ email: zod_1.z.string().trim().email().max(255).transform((value) => value.toLowerCase()), password: zod_1.z.string().min(1).max(128) });
const conversationSchema = zod_1.z.object({ userId: zod_1.z.string().uuid() });
const messageSchema = zod_1.z.object({ content: zod_1.z.string().trim().min(1).max(4000), clientMessageId: zod_1.z.string().min(8).max(64) });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({ destination: fileStore, filename: (_req, _file, callback) => callback(null, (0, node_crypto_1.randomUUID)()) }),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
function publicUser(user) {
    return { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status };
}
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'chaty-api' }));
app.get('/api/config', (_req, res) => res.json({ service: 'chaty-api', features: { accounts: true, privateMessaging: true, uploads: true } }));
app.post('/api/auth/register', async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid registration details', details: parsed.error.flatten().fieldErrors });
    try {
        const { username, email, password, displayName } = parsed.data;
        const passwordHash = await argon2_1.default.hash(password, { type: argon2_1.default.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
        const user = await prisma.user.create({ data: { username, email, passwordHash, displayName } });
        return res.status(201).json({ user: publicUser(user), accessToken: (0, auth_1.signAccessToken)(user.id), expiresIn: 900 });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
            return res.status(409).json({ error: 'That email or username is already registered' });
        return next(error);
    }
});
app.post('/api/auth/login', async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Enter a valid email and password' });
    try {
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        const valid = user && await argon2_1.default.verify(user.passwordHash, parsed.data.password);
        if (!valid || !user)
            return res.status(401).json({ error: 'Email or password is incorrect' });
        await prisma.user.update({ where: { id: user.id }, data: { status: 'online' } });
        return res.json({ user: publicUser({ ...user, status: 'online' }), accessToken: (0, auth_1.signAccessToken)(user.id), expiresIn: 900 });
    }
    catch (error) {
        return next(error);
    }
});
app.get('/api/auth/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        return user ? res.json({ user: publicUser(user) }) : res.status(404).json({ error: 'Account not found' });
    }
    catch (error) {
        return next(error);
    }
});
app.post('/api/auth/logout', auth_1.authenticate, async (req, res, next) => {
    try {
        await prisma.user.update({ where: { id: req.userId }, data: { status: 'offline' } });
        return res.status(204).end();
    }
    catch (error) {
        return next(error);
    }
});
app.get('/api/users/search', auth_1.authenticate, async (req, res, next) => {
    const query = zod_1.z.string().trim().min(2).max(40).safeParse(req.query.q);
    if (!query.success)
        return res.status(400).json({ error: 'Search must contain 2 to 40 characters' });
    try {
        const users = await prisma.user.findMany({
            where: { id: { not: req.userId }, OR: [{ username: { contains: query.data } }, { displayName: { contains: query.data } }] },
            select: { id: true, username: true, displayName: true, avatarUrl: true, status: true }, take: 20,
        });
        return res.json({ users: users.map(publicUser) });
    }
    catch (error) {
        return next(error);
    }
});
app.get('/api/conversations', auth_1.authenticate, async (req, res, next) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: { members: { some: { userId: req.userId } } },
            include: {
                members: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } } },
                messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { username: true, displayName: true } } } },
            }, orderBy: { updatedAt: 'desc' }, take: 100,
        });
        return res.json({ conversations: conversations.map((conversation) => ({
                id: conversation.id, type: conversation.type, name: conversation.name,
                members: conversation.members.map((member) => publicUser(member.user)),
                lastMessage: conversation.messages[0] ? { content: conversation.messages[0].content, createdAt: conversation.messages[0].createdAt, sender: conversation.messages[0].sender } : null,
            })) });
    }
    catch (error) {
        return next(error);
    }
});
app.post('/api/conversations', auth_1.authenticate, async (req, res, next) => {
    const parsed = conversationSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'A valid userId is required' });
    if (parsed.data.userId === req.userId)
        return res.status(400).json({ error: 'You cannot start a conversation with yourself' });
    try {
        const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        const existing = await prisma.conversation.findFirst({ where: { type: 'private', AND: [{ members: { some: { userId: req.userId } } }, { members: { some: { userId: target.id } } }] } });
        if (existing)
            return res.json({ conversationId: existing.id });
        const conversation = await prisma.conversation.create({ data: { type: 'private', members: { create: [{ userId: req.userId, role: 'owner' }, { userId: target.id }] } } });
        io.to(`user:${req.userId}`).to(`user:${target.id}`).emit('conversation:new', { conversationId: conversation.id });
        return res.status(201).json({ conversationId: conversation.id });
    }
    catch (error) {
        return next(error);
    }
});
app.get('/api/conversations/:id/messages', auth_1.authenticate, async (req, res, next) => {
    const id = zod_1.z.string().uuid().safeParse(req.params.id);
    if (!id.success)
        return res.status(404).json({ error: 'Conversation not found' });
    const conversationId = id.data;
    const cursor = typeof req.query.before === 'string' ? req.query.before : undefined;
    const takeParsed = Number(req.query.limit ?? 40);
    const take = Number.isFinite(takeParsed) ? Math.min(100, Math.max(1, Math.floor(takeParsed))) : 40;
    try {
        const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: req.userId } }, select: { userId: true } });
        if (!member)
            return res.status(404).json({ error: 'Conversation not found' });
        const messages = await prisma.message.findMany({
            where: { conversationId, deletedAt: null },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' }, take,
            include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } }, attachments: true, receipts: { where: { userId: req.userId } } },
        });
        return res.json({ messages: messages.reverse().map((message) => ({ ...message, attachments: message.attachments.map((attachment) => ({ ...attachment, fileSize: attachment.fileSize.toString() })) })) });
    }
    catch (error) {
        return next(error);
    }
});
app.post('/api/conversations/:id/messages', auth_1.authenticate, async (req, res, next) => {
    const id = zod_1.z.string().uuid().safeParse(req.params.id);
    if (!id.success)
        return res.status(404).json({ error: 'Conversation not found' });
    const conversationId = id.data;
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Message must contain 1 to 4,000 characters and a clientMessageId' });
    try {
        const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: req.userId } }, select: { userId: true } });
        if (!member)
            return res.status(404).json({ error: 'Conversation not found' });
        const message = await persistMessage(req.userId, conversationId, parsed.data.content, parsed.data.clientMessageId);
        io.to(`conversation:${conversationId}`).emit('message:new', message);
        return res.status(201).json({ message });
    }
    catch (error) {
        return next(error);
    }
});
app.post('/api/conversations/:id/files', auth_1.authenticate, async (req, res, next) => {
    const id = zod_1.z.string().uuid().safeParse(req.params.id);
    if (!id.success)
        return res.status(404).json({ error: 'Conversation not found' });
    const conversationId = id.data;
    try {
        const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: req.userId } }, select: { userId: true } });
        if (!member)
            return res.status(404).json({ error: 'Conversation not found' });
        return upload.single('file')(req, res, async (error) => {
            if (error)
                return next(error);
            if (!req.file)
                return res.status(400).json({ error: 'Choose a file to upload' });
            try {
                const handle = await node_fs_1.promises.open(req.file.path, 'r');
                const header = Buffer.alloc(Math.min(512, req.file.size));
                await handle.read(header, 0, header.length, 0);
                await handle.close();
                const mimeType = detectMime(header);
                if (!mimeType) {
                    await node_fs_1.promises.unlink(req.file.path).catch(() => undefined);
                    return res.status(415).json({ error: 'This file type is not permitted' });
                }
                const fileName = node_path_1.default.basename(req.file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(-255) || 'download';
                const clientMessageId = (0, node_crypto_1.randomUUID)();
                const message = await prisma.$transaction(async (tx) => {
                    const created = await tx.message.create({
                        data: { conversationId, senderId: req.userId, content: fileName, type: 'attachment', clientMessageId,
                            receipts: { create: [{ userId: req.userId, status: 'sent' }] },
                            attachments: { create: { fileName, mimeType, fileSize: BigInt(req.file.size), storageKey: req.file.filename } },
                        }, include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } }, attachments: true },
                    });
                    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
                    return created;
                });
                const safeMessage = { ...message, attachments: message.attachments.map((item) => ({ ...item, fileSize: item.fileSize.toString() })) };
                io.to(`conversation:${conversationId}`).emit('message:new', safeMessage);
                return res.status(201).json({ message: safeMessage });
            }
            catch (uploadError) {
                await node_fs_1.promises.unlink(req.file.path).catch(() => undefined);
                return next(uploadError);
            }
        });
    }
    catch (error) {
        return next(error);
    }
});
app.get('/api/files/:id/download', auth_1.authenticate, async (req, res, next) => {
    const id = zod_1.z.string().uuid().safeParse(req.params.id);
    if (!id.success)
        return res.status(404).json({ error: 'File not found' });
    try {
        const attachment = await prisma.attachment.findFirst({
            where: { id: id.data, message: { conversation: { members: { some: { userId: req.userId } } } } },
            select: { fileName: true, mimeType: true, fileSize: true, storageKey: true },
        });
        if (!attachment)
            return res.status(404).json({ error: 'File not found' });
        const preview = req.query.preview === 'true' && Boolean(attachment.mimeType && (attachment.mimeType === 'application/pdf' || attachment.mimeType.startsWith('image/')));
        res.setHeader('Content-Type', preview ? attachment.mimeType : 'application/octet-stream');
        res.setHeader('Content-Length', attachment.fileSize.toString());
        res.setHeader('Content-Disposition', `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        const stream = (0, node_fs_1.createReadStream)(node_path_1.default.join(fileStore, attachment.storageKey));
        stream.on('error', next);
        stream.pipe(res);
    }
    catch (error) {
        return next(error);
    }
});
function detectMime(header) {
    if (header.subarray(0, 5).toString('ascii') === '%PDF-')
        return 'application/pdf';
    if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
        return 'image/png';
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)
        return 'image/jpeg';
    if (header.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/))
        return 'image/gif';
    if (header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP')
        return 'image/webp';
    if (header.subarray(0, 4).toString('hex') === '504b0304')
        return 'application/zip';
    if (header.length >= 2 && header[0] === 0x4d && header[1] === 0x5a)
        return null;
    const beginning = header.toString('utf8').trimStart().slice(0, 128).toLowerCase();
    if (/^(<!doctype\s+html|<html|<svg|<script)/.test(beginning))
        return null;
    if (header.length >= 4 && header[0] === 0x7f && header.subarray(1, 4).toString('ascii') === 'ELF')
        return null;
    return 'application/octet-stream';
}
async function persistMessage(senderId, conversationId, content, clientMessageId) {
    const unique = { senderId_clientMessageId: { senderId, clientMessageId } };
    const existing = await prisma.message.findUnique({ where: unique, include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } });
    if (existing && existing.conversationId !== conversationId)
        throw new Error('Client message ID was already used in another conversation');
    const message = existing ?? await prisma.message.create({
        data: { senderId, conversationId, content, clientMessageId, receipts: { create: [{ userId: senderId, status: 'sent' }] } },
        include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
}
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string' || !process.env.JWT_SECRET)
            return next(new Error('Authentication required'));
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, { issuer: 'chaty-api', audience: 'chaty-desktop' });
        if (typeof payload === 'string' || !payload.sub)
            return next(new Error('Invalid access token'));
        socket.data.userId = payload.sub;
        return next();
    }
    catch {
        return next(new Error('Invalid or expired access token'));
    }
});
io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    try {
        const memberships = await prisma.conversationMember.findMany({ where: { userId }, select: { conversationId: true } });
        memberships.forEach(({ conversationId }) => socket.join(`conversation:${conversationId}`));
        socket.join(`user:${userId}`);
        await prisma.user.update({ where: { id: userId }, data: { status: 'online' } });
        socket.on('conversation:join', async (input) => {
            const parsed = zod_1.z.object({ conversationId: zod_1.z.string().uuid() }).safeParse(input);
            if (!parsed.success)
                return;
            const membership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: parsed.data.conversationId, userId } }, select: { userId: true } });
            if (membership)
                socket.join(`conversation:${parsed.data.conversationId}`);
        });
        socket.on('message:send', async (input, acknowledge) => {
            const parsed = zod_1.z.object({ conversationId: zod_1.z.string().uuid(), content: zod_1.z.string().trim().min(1).max(4000), clientMessageId: zod_1.z.string().min(8).max(64) }).safeParse(input);
            if (!parsed.success)
                return acknowledge?.({ ok: false, error: 'Invalid message payload' });
            try {
                const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: parsed.data.conversationId, userId } }, select: { userId: true } });
                if (!member)
                    return acknowledge?.({ ok: false, error: 'Conversation not found' });
                const message = await persistMessage(userId, parsed.data.conversationId, parsed.data.content, parsed.data.clientMessageId);
                io.to(`conversation:${parsed.data.conversationId}`).emit('message:new', message);
                return acknowledge?.({ ok: true, message });
            }
            catch {
                return acknowledge?.({ ok: false, error: 'Message could not be sent' });
            }
        });
    }
    catch {
        socket.disconnect(true);
    }
    socket.on('disconnect', async () => {
        try {
            const activeSockets = await io.in(`user:${userId}`).fetchSockets();
            if (activeSockets.length === 0)
                await prisma.user.update({ where: { id: userId }, data: { status: 'offline' } });
        }
        catch { /* Presence is best-effort during shutdown. */ }
    });
});
app.use((error, _req, res, _next) => {
    if (error instanceof multer_1.default.MulterError) {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: status === 413 ? 'Files must be 25 MB or smaller' : 'The upload could not be processed' });
    }
    console.error('Request failed', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
const port = Number(process.env.PORT ?? 3001);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('Set JWT_SECRET to a random value of at least 32 characters before starting the server.');
    process.exit(1);
}
httpServer.listen(port, () => console.info(`Chaty API listening on port ${port}`));
async function shutdown() {
    io.close();
    httpServer.close();
    await prisma.$disconnect();
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
