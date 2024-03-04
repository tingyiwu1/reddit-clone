import { LoaderFunctionArgs, json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { prisma } from '~/db.server';
import { useEffect, useRef, useState } from 'react';
import { Comment } from './post.$postId';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const comment = await prisma.comment.findUnique({
    where: {
      id: params.commentId,
    },
  });

  const replies = await prisma.comment.findMany({
    where: {
      parent_id: params.commentId,
    },
    orderBy: {
      score: 'desc',
    },
    include: {
      _count: {
        select: { children: true },
      },
    },
  });

  return json({
    comment,
    replies,
  });
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