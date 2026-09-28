CREATE TABLE "AiInsightCard" (
    "id" SERIAL NOT NULL,
    "rangeKey" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInsightCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiInsightCard_rangeKey_dayKey_key" ON "AiInsightCard"("rangeKey", "dayKey");
