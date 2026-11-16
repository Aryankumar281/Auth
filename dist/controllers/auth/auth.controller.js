"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandler = registerHandler;
exports.verifyEmailHandler = verifyEmailHandler;
exports.loginHandler = loginHandler;
const auth_schema_1 = require("./auth.schema");
const user_model_1 = require("../../models/user.model");
const hash_1 = require("../../lib/hash");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const email_1 = require("../../lib/email");
const token_1 = require("../../lib/token");
function getAppUrl() {
    return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}
async function registerHandler(req, res) {
    try {
        const result = auth_schema_1.registerSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                message: "Invalid data",
                errors: result.error.flatten(),
            });
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error("JWT_SECRET is not configured.");
            return res.status(500).json({ message: "Server configuration error" });
        }
        const { email, password, name } = result.data;
        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await user_model_1.User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({
                message: "User already exists",
            });
        }
        const passwordHash = await (0, hash_1.hashPassword)(password);
        const newUser = await user_model_1.User.create({
            email: normalizedEmail,
            passwordHash,
            name,
            roles: "user",
            isEmailVerified: false,
            twoFactorAuthEnabled: false,
        });
        // email vewrification logic will be implemented here
        const verificationToken = jsonwebtoken_1.default.sign({
            sub: newUser._id.toString(),
        }, jwtSecret, { expiresIn: "1d" });
        const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${verificationToken}`;
        await (0, email_1.sendEmail)(newUser.email, "Verify your email", `
      <p>Hi ${newUser.name},</p>
      <p>Thank you for registering. Please verify your email by clicking the link below:</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>If you did not register, please ignore this email.</p>
      `).catch((error) => {
            console.error("Failed to send verification email:", error);
        });
        return res.status(201).json({
            message: "User registered successfully.",
            user: {
                id: newUser._id,
                email: newUser.email,
                name: newUser.name,
                roles: newUser.roles,
                isEmailVerified: newUser.isEmailVerified,
                twoFactorAuthEnabled: newUser.twoFactorAuthEnabled,
            },
        });
    }
    catch (error) {
        return res.status(500).json({
            message: "Internal server error",
        });
    }
}
async function verifyEmailHandler(req, res) {
    const token = req.query.token;
    if (!token) {
        return res.status(400).json({ message: " verification token is missing" });
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error("JWT_SECRET is not configured.");
        return res.status(500).json({ message: "Server configuration error" });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        const user = await user_model_1.User.findById(payload.sub);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.isEmailVerified) {
            return res.json({ message: "Email is already verified" });
        }
        user.isEmailVerified = true;
        await user.save();
        return res.json({
            message: "Email verified successfully, you can now login",
        });
    }
    catch (error) {
        console.log(error);
        return res.status(400).json({ message: "Internal server error" });
    }
}
async function loginHandler(req, res) {
    try {
        const result = auth_schema_1.loginSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                message: "Invalid data",
                errors: result.error.flatten(),
            });
        }
        const { email, password } = result.data;
        const normalizedEmail = email.toLowerCase().trim();
        const user = await user_model_1.User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        if (!user.isEmailVerified) {
            return res.status(403).json({ message: "Email is not verified" });
        }
        const ok = await (0, hash_1.comparePassword)(password, user.passwordHash);
        if (!ok) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const accessToken = (0, token_1.generateAccessToken)(user._id.toString(), user.roles, user.tokenVersion);
        const refreshToken = (0, token_1.generateRefreshToken)(user._id.toString(), user.tokenVersion);
        const isSecure = process.env.NODE_ENV === "production";
        res.cookie("jid", refreshToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: isSecure ? "none" : "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        });
        res.status(200).json({
            message: "Login successful",
            accessToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                roles: user.roles,
                isEmailVerified: user.isEmailVerified,
                twoFactorAuthEnabled: user.twoFactorAuthEnabled,
            },
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
