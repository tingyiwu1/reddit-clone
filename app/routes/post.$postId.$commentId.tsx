import { ActionFunctionArgs, LoaderFunctionArgs, json } from '@remix-run/node';
import type { ShouldRevalidateFunctionArgs } from '@remix-run/react';
import { prisma } from '~/db.server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const comment = await prisma.comment.findUnique({
    where: {
      id: params.commentId,
    },
  });

  const url = new URL(request.url);

  const orderBy: Prisma.CommentFindManyArgs['orderBy'] =
    url.searchParams.get('sort') === 'new'
      ? { created_utc: 'desc' }
      : { score: 'desc' };

  const replies = await prisma.comment.findMany({
    where: {
      parent_id: params.commentId,
    },
    orderBy,
    include: {
      _count: {
        select: { children: true },
      },
    },
  });

  return json({ comment, replies });
};

export const newCommentData = z.object({
  author: z.string(),
  body: z.string(),
  is_root: z.optional(z.literal('on')),
});

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (!params.postId) {
    throw new Response('Post not found', { status: 404 });
  }

  const post = await prisma.post.findUnique({
    where: {
      id: params.postId,
    },
    select: {
      id: true,
    },
  });

  if (!post) {
    throw new Response('Post not found', { status: 404 });
  }

  const formData = await request.formData();

  const parsed = newCommentData.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    throw new Response(JSON.stringify(parsed.error), { status: 400 });
  }

  if (!parsed.data.is_root && !params.commentId) {
    throw new Response('Need parent commentId for non root comment', {
      status: 400,
    });
  }

  const parent = parsed.data.is_root
    ? null
    : await prisma.comment.findUnique({
        where: {
          id: params.commentId,
        },
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

  if (parsed.data.is_root) {
    return json({ comment: newComment, replies: [] });
  }

  const url = new URL(request.url);

  const orderBy: Prisma.CommentFindManyArgs['orderBy'] =
    url.searchParams.get('sort') === 'new'
      ? { created_utc: 'desc' }
      : { score: 'desc' };

  const replies = await prisma.comment.findMany({
    where: {
      parent_id: params.commentId,
    },
    orderBy,
    include: {
      _count: {
        select: { children: true },
      },
    },
  });

  // put new reply at the top
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

// export default function SoloComment() {
//   const {comment, replies} = useLoaderData<typeof loader>();

//   if (!comment) return null;

//  return (
//   <div>
//     <Comment comment={{
//       ...comment,
//       numReplies: replies.length,
//     }}

//     />
//   </div>
//  )
// }
