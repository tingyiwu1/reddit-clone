import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import { createInterface } from 'readline/promises';

const prisma = new PrismaClient();

async function seedPosts(index: number) {
  const file_name = `sample_data/posts/${String(index).padStart(12, '0')}.json`;
  const stream = fs.createReadStream(file_name, 'utf-8');
  console.log(file_name);

  const posts: IPost[] = [];
  for await (const line of createInterface({
    input: stream,
  })) {
    if (line === '') {
      console.log('Empty line');
      continue;
    }
    posts.push(JSON.parse(line));
  }

  console.log(`Seeding ${file_name}`);
  await prisma.post.createMany({
    data: posts
      // .filter((post) => post.subreddit === 'funny')
      .map((post) => {
        const {
          author_fullname: _,
          name: __,
          subreddit_id: ___,
          ...rest
        } = post;
        return {
          ...rest,
          created_utc: new Date(post.created_utc),
          score: parseInt(post.score),
          selftext: post.selftext.replaceAll('\u0000', ''),
        };
      }),
    skipDuplicates: true,
  });
}

async function seedComments(index: number) {
  const file_name = `sample_data/comments/${String(index).padStart(
    12,
    '0',
  )}.json`;
  if (!fs.existsSync(file_name)) {
    return;
  }
  const stream = fs.createReadStream(file_name, 'utf-8');
  const parents: [string, string][] = [];
  console.log(file_name);

  const comments: IComment[] = [];
  for await (const line of createInterface({
    input: stream,
  })) {
    if (line === '') {
      console.log('Empty line');
      continue;
    }
    comments.push(JSON.parse(line));
  }

  console.log(`Seeding ${file_name}`);
  await prisma.comment.createMany({
    data: comments
      // .filter((comment) => comment.link_id === 't3_1037wz4')
      .map((comment) => {
        const {
          author_fullname: _,
          name: __,
          subreddit: ___,
          subreddit_id: ____,
          link_id: _____,
          ...rest
        } = comment;
        if (comment.parent_id.startsWith('t1_')) {
          parents.push([comment.id, comment.parent_id.slice(3)]);
        }
        return {
          ...rest,
          created_utc: new Date(comment.created_utc),
          score: parseInt(comment.score),
          gilded: parseInt(comment.gilded),
          post_id: comment.link_id.slice(3),
          parent_id: null,
          is_root: comment.parent_id.startsWith('t3_'),
        };
      }),
    skipDuplicates: true,
  });
  fs.writeFileSync(
    `sample_data/parents/${String(index).padStart(12, '0')}.json`,
    JSON.stringify(parents),
  );
}

async function seedParents(index: number) {
  const file_name = `sample_data/parents/${String(index).padStart(
    12,
    '0',
  )}.json`;
  if (!fs.existsSync(file_name)) {
    return;
  }
  const parents: [string, string][] = JSON.parse(
    fs.readFileSync(file_name, 'utf-8'),
  );
  console.log(file_name);

  for (let i = 0; i < parents.length; i += 16_000) {
    const batch = parents.slice(i, i + 16_000);

    const foundParents = await prisma.comment.findMany({
      where: {
        id: {
          in: batch.map(([_, id]) => id),
        },
      },
      select: {
        id: true,
      },
    });

    const foundIds = new Set(foundParents.map((p) => p.id));

    const values = Prisma.join(
      batch
        .filter(([_, parent_id]) => foundIds.has(parent_id))
        .map(([id, parent_id]) => Prisma.sql`(${id}, ${parent_id})`),
      ',',
    );
    const affected = await prisma.$executeRaw`
    UPDATE "Comment"
    SET "parent_id" = "x"."parent_id"
    FROM (VALUES ${values}) AS "x"("id", "parent_id")
    WHERE "Comment"."id" = "x"."id"
    `;
    console.log(`processed ${i} - ${i + 16_000}, affected ${affected} rows.`);
  }
}

async function main() {
  console.log(`Start seeding ...`);

  for (let i = 0; i < 34; i++) {
    await seedPosts(i);
  }

  for (let i = 0; i < 136; i++) {
    await seedComments(i);
  }

  for (let i = 0; i < 136; i++) {
    await seedParents(i);
  }

  console.log(`Seeding finished.`);
}

export type IPost = {
  author: string;
  author_fullname: string;
  created_utc: string;
  id: string;
  name: string;
  over_18: boolean;
  permalink: string;
  score: string;
  selftext: string;
  subreddit: string;
  subreddit_id: string;
  thumbnail: string;
  title: string;
  url: string;
};

export type IComment = {
  author: string;
  author_fullname: string;
  body: string;
  created_utc: string;
  edited: boolean;
  gilded: string;
  id: string;
  is_submitter: boolean;
  link_id: string;
  locked: boolean;
  name: string;
  parent_id: string;
  permalink: string;
  score: string;
  subreddit: string;
  subreddit_id: string;
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
