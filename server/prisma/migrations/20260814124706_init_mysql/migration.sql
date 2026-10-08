-- CreateTable
CREATE TABLE `Player` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NOT NULL,
    `age` VARCHAR(191) NOT NULL,
    `currentTier` VARCHAR(191) NOT NULL,
    `highestTier` VARCHAR(191) NOT NULL,
    `lineTop` BOOLEAN NOT NULL DEFAULT false,
    `lineJungle` BOOLEAN NOT NULL DEFAULT false,
    `lineMid` BOOLEAN NOT NULL DEFAULT false,
    `lineAd` BOOLEAN NOT NULL DEFAULT false,
    `lineSupport` BOOLEAN NOT NULL DEFAULT false,
    `maxTierSort` INTEGER NOT NULL DEFAULT 26,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `losses` INTEGER NOT NULL DEFAULT 0,
    `mmr` INTEGER NOT NULL DEFAULT 1000,
    `totalVoiceTime` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Player_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `blueTeam` TEXT NOT NULL,
    `redTeam` TEXT NOT NULL,
    `winner` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lobby` (
    `id` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `creatorName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `participants` TEXT NOT NULL,
    `blueTeam` TEXT NULL,
    `redTeam` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `userName` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `channelName` VARCHAR(191) NOT NULL,
    `joinTime` DATETIME(3) NOT NULL,
    `leaveTime` DATETIME(3) NOT NULL,
    `duration` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
