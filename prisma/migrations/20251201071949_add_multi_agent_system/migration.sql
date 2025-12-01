-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboarding_complete" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "agent_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "current_agent" TEXT NOT NULL,
    "active_flow" TEXT,
    "flow_data" JSONB,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_participants" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "share" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "expense_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_states_user_id_idx" ON "agent_states"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_states_user_id_key" ON "agent_states"("user_id");

-- CreateIndex
CREATE INDEX "expenses_user_id_created_at_idx" ON "expenses"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "expense_participants_expense_id_idx" ON "expense_participants"("expense_id");

-- AddForeignKey
ALTER TABLE "agent_states" ADD CONSTRAINT "agent_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
