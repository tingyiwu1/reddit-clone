-- CreateTable
CREATE TABLE "Post" (
    "author" TEXT NOT NULL,
    "created_utc" TIMESTAMP(3) NOT NULL,
    "id" TEXT NOT NULL,
    "over_18" BOOLEAN NOT NULL,
    "permalink" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "selftext" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_utc" TIMESTAMP(3) NOT NULL,
    "edited" BOOLEAN NOT NULL,
    "gilded" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "is_submitter" BOOLEAN NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "permalink" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "post_id" TEXT NOT NULL,
    "is_root" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_subreddit_idx" ON "Post"("subreddit");

-- CreateIndex
CREATE INDEX "Post_subreddit_created_utc_idx" ON "Post"("subreddit", "created_utc");

-- CreateIndex
CREATE INDEX "Post_subreddit_score_idx" ON "Post"("subreddit", "score");

-- CreateIndex
CREATE INDEX "Comment_post_id_idx" ON "Comment"("post_id");

-- CreateIndex
CREATE INDEX "Comment_post_id_created_utc_idx" ON "Comment"("post_id", "created_utc");

-- CreateIndex
CREATE INDEX "Comment_post_id_score_idx" ON "Comment"("post_id", "score");

-- CreateIndex
CREATE INDEX "Comment_post_id_parent_id_idx" ON "Comment"("post_id", "parent_id");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
