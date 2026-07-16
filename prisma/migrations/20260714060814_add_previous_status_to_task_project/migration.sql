-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "previousStatus" "WorkStatus";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "previousStatus" "WorkStatus";
