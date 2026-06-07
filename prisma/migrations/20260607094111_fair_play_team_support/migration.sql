-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RewardPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "playerId" TEXT,
    "teamCode" TEXT,
    "points" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RewardPrediction_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RewardPrediction" ("createdAt", "id", "participantId", "playerId", "points", "rewardType", "updatedAt") SELECT "createdAt", "id", "participantId", "playerId", "points", "rewardType", "updatedAt" FROM "RewardPrediction";
DROP TABLE "RewardPrediction";
ALTER TABLE "new_RewardPrediction" RENAME TO "RewardPrediction";
CREATE UNIQUE INDEX "RewardPrediction_participantId_rewardType_key" ON "RewardPrediction"("participantId", "rewardType");
CREATE TABLE "new_RewardResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rewardType" TEXT NOT NULL,
    "playerId" TEXT,
    "teamCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RewardResult" ("createdAt", "id", "playerId", "rewardType", "updatedAt") SELECT "createdAt", "id", "playerId", "rewardType", "updatedAt" FROM "RewardResult";
DROP TABLE "RewardResult";
ALTER TABLE "new_RewardResult" RENAME TO "RewardResult";
CREATE UNIQUE INDEX "RewardResult_rewardType_key" ON "RewardResult"("rewardType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
