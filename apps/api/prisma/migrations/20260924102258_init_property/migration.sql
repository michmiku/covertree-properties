-- S3.2 city substring filter uses a trigram GIN index (properties_city_trgm_idx).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "USState" AS ENUM ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'GU', 'VI', 'AS', 'MP');

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "street" VARCHAR(200) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" "USState" NOT NULL,
    "zip_code" CHAR(5) NOT NULL,
    "weather_data" JSONB NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "long" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "properties_created_at_id_idx" ON "properties"("created_at", "id");

-- CreateIndex
CREATE INDEX "properties_city_trgm_idx" ON "properties" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "properties_state_idx" ON "properties"("state");

-- CreateIndex
CREATE INDEX "properties_zip_code_idx" ON "properties"("zip_code");

-- CreateIndex
CREATE UNIQUE INDEX "properties_street_city_state_zip_code_key" ON "properties"("street", "city", "state", "zip_code");
