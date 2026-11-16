import { Request, Response } from "express";
import { registerSchema, loginSchema } from "./auth.schema";
import { User } from "../../models/user.model";
import { hashPassword, comparePassword } from "../../lib/hash";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../lib/email";
import { generateAccessToken, generateRefreshToken } from "../../lib/token";

function getAppUrl() {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

export async function registerHandler(req: Request, res: Response) {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid data",
        errors: result.error.flatten(),
      });
    }

    const { email, password, name } = result.data;
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }
    const passwordHash = await hashPassword(password);
    const newUser = await User.create({
      email: normalizedEmail,
      passwordHash,
      name,
      roles: "user",
      isEmailVerified: false,
      twoFactorAuthEnabled: false,
    });

    // email vewrification logic will be implemented here

    const verificationToken = jwt.sign(
      {
        sub: newUser._id.toString(),
      },
      process.env.JWT_ACCESS_SECRET || "secret",
      { expiresIn: "1d" },
    );

    const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${verificationToken}`;
    await sendEmail(
      newUser.email,
      "Verify your email",
      `
      <p>Hi ${newUser.name},</p>
      <p>Thank you for registering. Please verify your email by clicking the link below:</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>If you did not register, please ignore this email.</p>
      `,
    ).catch((error) => {
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
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function verifyEmailHandler(req: Request, res: Response) {
  const token = req.query.token as string | undefined;
  if (!token) {
    return res.status(400).json({ message: " verification token is missing" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
      sub: string;
    };

    const user = await User.findById(payload.sub);
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
  } catch (error) {
    console.log(error);
    return res.status(400).json({ message: "Internal server error" });
  }
}

export async function loginHandler(req: Request, res: Response) {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid data",
        errors: result.error.flatten(),
      });
    }

    const { email, password } = result.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ message: "Email is not verified" });
    }

    const ok = await comparePassword(password, user.passwordHash);

    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const accessToken = generateAccessToken(
      user._id.toString(),
      user.roles,
      user.tokenVersion,
    );

    const refreshToken = generateRefreshToken(
      user._id.toString(),
      user.tokenVersion,
    );

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
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
