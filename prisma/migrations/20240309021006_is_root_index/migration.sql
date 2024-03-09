-- CreateIndex
CREATE INDEX "Comment_post_id_is_root_idx" ON "Comment"("post_id", "is_root");

-- CreateIndex
CREATE INDEX "Comment_post_id_is_root_created_utc_idx" ON "Comment"("post_id", "is_root", "created_utc");

-- CreateIndex
CREATE INDEX "Comment_post_id_is_root_score_idx" ON "Comment"("post_id", "is_root", "score");
