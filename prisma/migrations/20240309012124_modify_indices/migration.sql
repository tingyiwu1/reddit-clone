-- DropIndex
DROP INDEX "Comment_post_id_parent_id_idx";

-- CreateIndex
CREATE INDEX "Comment_parent_id_idx" ON "Comment"("parent_id");

-- CreateIndex
CREATE INDEX "Comment_parent_id_created_utc_idx" ON "Comment"("parent_id", "created_utc");

-- CreateIndex
CREATE INDEX "Comment_parent_id_score_idx" ON "Comment"("parent_id", "score");
