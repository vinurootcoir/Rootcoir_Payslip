/**
 * Development-only seed for the Super Admin login.
 *
 * Reads BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_PASSWORD from .env.
 * Does not run unless NODE_ENV is development.
 * There is no default account. Do not commit the password.
 *
 *   npm run db:seed
 */
import { config } from "dotenv";
import { z } from "zod";
import { hashPassword } from "../src/server/auth/password";

config();

const inputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(128),
});

async function main() {
  if (process.env.NODE_ENV !== "development") {
    console.error("Seed runs only when NODE_ENV is development.");
    process.exitCode = 1;
    return;
  }

  const parsed = inputSchema.safeParse({
    email: process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    console.error(
      "Set BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_PASSWORD in .env. The password must be 6 to 128 characters.",
    );
    process.exitCode = 1;
    return;
  }

  const { getEnv } = await import("../src/lib/env");
  getEnv();

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });

  try {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, role: true },
    });

    if (existing && existing.role !== "SUPER_ADMIN") {
      console.error(`Refusing to change the role of ${parsed.data.email}.`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, status: "ACTIVE" },
      });
      console.log(`Super Admin updated for ${parsed.data.email}.`);
      return;
    }

    await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    console.log(`Super Admin created for ${parsed.data.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.name === "EnvironmentConfigError") {
    console.error(error.message);
  } else {
    console.error("Development seed failed.");
  }
  process.exitCode = 1;
});
