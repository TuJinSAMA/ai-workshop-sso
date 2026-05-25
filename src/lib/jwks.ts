import { exportJWK, importPKCS8, importSPKI, generateKeyPair, type JWK } from "jose";
import { prisma } from "./db";

// JWKS loading + rotation helpers. See spec Section 12.5.
//
// Strategy:
// - On first call, ensure at least one ACTIVE SigningKey exists in DB.
//   If none, generate a fresh RSA 2048 keypair and persist it.
// - getCurrentSigningKey() returns the most recent ACTIVE key (for signing).
// - getAllPublicJwks() returns all ACTIVE + RETIRED public keys (for JWKS endpoint).

export type LoadedKey = {
  kid: string;
  algorithm: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
};

async function generateAndStoreActiveKey(): Promise<{
  kid: string;
  algorithm: string;
  publicKeyPem: string;
  privateKeyPem: string;
}> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  const [publicKeyPem, privateKeyPem] = await Promise.all([
    exportPemFromKey(publicKey, "PUBLIC KEY"),
    exportPemFromKey(privateKey, "PRIVATE KEY"),
  ]);
  const kid = crypto.randomUUID();
  await prisma.signingKey.create({
    data: { kid, algorithm: "RS256", publicKeyPem, privateKeyPem, status: "ACTIVE" },
  });
  return { kid, algorithm: "RS256", publicKeyPem, privateKeyPem };
}

async function exportPemFromKey(key: CryptoKey, label: "PUBLIC KEY" | "PRIVATE KEY"): Promise<string> {
  const format = label === "PUBLIC KEY" ? "spki" : "pkcs8";
  const raw = await crypto.subtle.exportKey(format, key);
  const b64 = Buffer.from(raw).toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}

export async function getCurrentSigningKey(): Promise<LoadedKey> {
  let row = await prisma.signingKey.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    const created = await generateAndStoreActiveKey();
    row = await prisma.signingKey.findUniqueOrThrow({ where: { kid: created.kid } });
  }
  const [publicKey, privateKey] = await Promise.all([
    importSPKI(row.publicKeyPem, row.algorithm),
    importPKCS8(row.privateKeyPem, row.algorithm),
  ]);
  return { kid: row.kid, algorithm: row.algorithm, publicKey, privateKey };
}

export async function getAllPublicJwks(): Promise<{ keys: JWK[] }> {
  const rows = await prisma.signingKey.findMany({
    where: { status: { in: ["ACTIVE", "RETIRED"] } },
    orderBy: { createdAt: "desc" },
  });
  const keys = await Promise.all(
    rows.map(async (row) => {
      const publicKey = await importSPKI(row.publicKeyPem, row.algorithm);
      const jwk = await exportJWK(publicKey);
      jwk.kid = row.kid;
      jwk.alg = row.algorithm;
      jwk.use = "sig";
      return jwk;
    }),
  );
  return { keys };
}

/** Mark current ACTIVE keys as RETIRED and generate a new ACTIVE keypair. */
export async function rotateSigningKey(): Promise<string> {
  await prisma.signingKey.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "RETIRED", retiredAt: new Date() },
  });
  const created = await generateAndStoreActiveKey();
  return created.kid;
}
