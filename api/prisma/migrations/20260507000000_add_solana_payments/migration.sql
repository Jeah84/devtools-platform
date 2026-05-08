CREATE TABLE "SolanaPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amountUsdc" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SolanaPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolanaPayment_reference_key" ON "SolanaPayment"("reference");

ALTER TABLE "SolanaPayment" ADD CONSTRAINT "SolanaPayment_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;