-- CreateEnum
CREATE TYPE "public"."AddonGroup" AS ENUM ('SERVICE', 'EQUIPMENT', 'MATERIAL');

-- AlterTable
ALTER TABLE "public"."Machine" ADD COLUMN     "addonGroup" "public"."AddonGroup";

-- Backfill existing service addon rows
UPDATE "public"."Machine"
SET "addonGroup" = 'SERVICE'
WHERE "code" IN ('addon-delivery', 'addon-pickup', 'addon-insurance', 'addon-operator');
