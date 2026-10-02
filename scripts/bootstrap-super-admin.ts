/**
 * Creates the first Super Admin. Refuses to run again once one exists.
 *
 * Password is taken from --password or BOOTSTRAP_SUPER_ADMIN_PASSWORD.
 * Do not commit either value. There is no default account.
 *
 *   npm run bootstrap:super-admin -- --email you@company.com --password "<one-time>"
 */
import { config } from "dotenv";
import { z } from "zod";
import { hashPassword } from "../src/server/auth/password";

config();

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

const inputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(128),
});

async function main() {
  const parsed = inputSchema.safeParse({
    email: readArg("--email") ?? process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL,
    password: readArg("--password") ?? process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    console.error(
      "Provide --email and a --password of 6 to 128 characters. You can also set BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_PASSWORD for this command only.",
    );
    process.exitCode = 1;
    return;
  }

  const { getEnv } = await import("../src/lib/env");
  getEnv();

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });

  try {
    const existing = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      select: { id: true },
    });

    if (existing) {
      console.error("A Super Admin already exists. Refusing to create another.");
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);

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
    console.error("Super Admin bootstrap failed.");
  }
  process.exitCode = 1;
});
