-- M1: switch to a single generic table that backs every oidc-provider
-- internal model (AccessToken / AuthorizationCode / RefreshToken / Grant /
-- Session / Interaction / ReplayDetection / IdToken / DeviceCode / etc.).
-- The hand-rolled AuthorizationCode and RefreshToken tables are dropped:
-- their data lives in OidcModel from now on (filter by `model`).

-- DropForeignKey (RefreshToken -> Session)
ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_sessionId_fkey";

-- DropTable
DROP TABLE IF EXISTS "RefreshToken";

-- DropTable
DROP TABLE IF EXISTS "AuthorizationCode";

-- CreateTable
CREATE TABLE "OidcModel" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "grantId" TEXT,
    "userCode" TEXT,
    "uid" TEXT,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OidcModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OidcModel_model_idx" ON "OidcModel"("model");
CREATE INDEX "OidcModel_grantId_idx" ON "OidcModel"("grantId");
CREATE INDEX "OidcModel_uid_idx" ON "OidcModel"("uid");
CREATE INDEX "OidcModel_userCode_idx" ON "OidcModel"("userCode");
CREATE INDEX "OidcModel_expiresAt_idx" ON "OidcModel"("expiresAt");
