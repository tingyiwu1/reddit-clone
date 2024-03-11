import { ActionFunctionArgs, LoaderFunctionArgs, json } from '@remix-run/node';
import type { ShouldRevalidateFunctionArgs } from '@remix-run/react';
import { prisma } from '~/db.server';
import { Comment, Prisma } from '@prisma/client';
import { z } from 'zod';

// loads a single comment and its replies
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const comment = await prisma.comment.findUnique({
    where: {
      id: params.commentId,
    },
  });

  const url = new URL(request.url);

  const orderBy =
    url.searchParams.get('sort') === 'new'
      ? Prisma.sql`c."created_utc" DESC`
      : Prisma.sql`c."score" DESC`;

  // select replies and include count of children
  const replies = await prisma.$queryRaw<(Comment & { numChildren: number })[]>`
    SELECT c.*, (SELECT COUNT(*)::int FROM "Comment" c2 WHERE c2."parent_id" = c.id) as "numChildren"
    FROM "Comment" c
    WHERE c."parent_id" = ${params.commentId}
    ORDER BY ${orderBy}
  `;

  // const orderBy: Prisma.CommentFindManyArgs['orderBy'] =
  //   url.searchParams.get('sort') === 'new'
  //     ? { created_utc: 'desc' }
  //     : { score: 'desc' };

  // const replies = await prisma.comment.findMany({
  //   where: {
  //     parent_id: params.commentId,
  //   },
  //   orderBy,
  //   include: {
  //     _count: {
  //       select: { children: true },
  //     },
  //   },
  // });

  return json({ comment, replies });
};

export const newCommentData = z.object({
  author: z.string(),
  body: z.string(),
  is_root: z.optional(z.literal('on')),
});

// creates new comment, returns parent comment and replies for revalidation
export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (!params.postId) {
    throw new Response('Post not found', { status: 404 });
  }

  // verify post exists
  const post = await prisma.post.findUnique({
    where: {
      id: params.postId,
    },
    select: {
      id: true,
    },
  });
  if (!post) throw new Response('Post not found', { status: 404 });

  // verify form data
  const formData = await request.formData();

  const parsed = newCommentData.safeParse(Object.fromEntries(formData));

  if (!parsed.success)
    throw new Response(JSON.stringify(parsed.error), { status: 400 });

  if (!parsed.data.is_root && !params.commentId)
    throw new Response('Need parent commentId for non root comment', {
      status: 400,
    });

  const newComment = await prisma.comment.create({
    data: {
      author: parsed.data.author,
      body: parsed.data.body,
      is_root: parsed.data.is_root ? true : false,
      post_id: params.postId,
      parent_id: parsed.data.is_root ? null : params.commentId,
      created_utc: new Date(),
      score: 0,
      edited: false,
      gilded: 0,
      is_submitter: false,
      locked: false,
      permalink: '',
    },
  });

  // creating root comment revalidates through the post route, so don't need to fetch replies
  if (parsed.data.is_root) return json({ comment: newComment, replies: [] });

  // fetch parent comment and replies for revalidating non-root comment
  const parent = await prisma.comment.findUnique({
    where: {
      id: params.commentId,
    },
  });

  const url = new URL(request.url);

  const orderBy =
    url.searchParams.get('sort') === 'new'
      ? Prisma.sql`c."created_utc" DESC`
      : Prisma.sql`c."score" DESC`;

  // select replies and include count of children
  const replies = await prisma.$queryRaw<(Comment & { numChildren: number })[]>`
    SELECT c.*, (SELECT COUNT(*)::int FROM "Comment" c2 WHERE c2."parent_id" = c.id) as "numChildren"
    FROM "Comment" c
    WHERE c."parent_id" = ${params.commentId}
    ORDER BY ${orderBy}
  `;

  // const orderBy: Prisma.CommentFindManyArgs['orderBy'] =
  //   url.searchParams.get('sort') === 'new'
  //     ? { created_utc: 'desc' }
  //     : { score: 'desc' };

  // const replies = await prisma.comment.findMany({
  //   where: {
  //     parent_id: params.commentId,
  //   },
  //   orderBy,
  //   include: {
  //     _count: {
  //       select: { children: true },
  //     },
  //   },
  // });

  // put new reply at the top when it is created so user sees it immediately
  // (will show up in the correct order on reload)
  const index = replies.findIndex((r) => r.id === newComment.id);
  if (index === -1) {
    throw new Response('Failed to create comment', { status: 500 });
  }
  const newReply = replies[index];
  // shift all replies before newReply down one
  for (let i = index; i > 0; i--) {
    replies[i] = replies[i - 1];
  }
  replies[0] = newReply; // put newReply at the top

  return json({ comment: parent, replies });
};

// prevent comments in other threads from revalidating
export const shouldRevalidate = ({
  currentParams,
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) => {
  if (currentParams.commentId !== formData?.get('commentId')) {
    return false;
  }
  return defaultShouldRevalidate;
};
