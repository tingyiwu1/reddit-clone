import { LoaderFunctionArgs, json } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { prisma } from '~/db.server';
import { useEffect, useState } from 'react';
import { loader as commentLoader } from './post.$postId.$commentId';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const post = await prisma.post.findUnique({
    where: {
      id: params.postId,
    },
  });

  const rootComments = await prisma.comment.findMany({
    where: {
      is_root: true,
      post_id: params.postId,
    },
    orderBy: {
      score: 'desc',
    },
    include: {
      children: {
        orderBy: {
          score: 'desc',
        },
        include: {
          _count: {
            select: {
              children: true,
            },
          },
        },
      },
    },
  });

  return json({
    post,
    rootComments,
  });
};

type CommentData = {
  id: string;
  body: string;
  numReplies: number;
};

type CommentProps = {
  comment: CommentData;
  parent_id: string | null;
  replies:
    | {
        loaded: true;
        data: CommentData[];
      }
    | {
        loaded: false;
      };
};

export function Comment({ comment, parent_id, replies }: CommentProps) {
  const [repliesData, setRepliesData] = useState<CommentData[] | null>(
    replies.loaded ? replies.data : null,
  );
  const fetcher = useFetcher<typeof commentLoader>();

  useEffect(() => {
    if (
      fetcher.state === 'loading' ||
      fetcher.data?.comment == null ||
      fetcher.data?.replies == null
    ) {
      return;
    }
    setRepliesData(
      fetcher.data.replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        numReplies: reply._count.children,
      })),
    );
  }, [fetcher.data, fetcher.state]);

  return (
    <div className="mb-10">
      <div>{comment.body}</div>
      <div className="pl-5">
        {comment.numReplies === 0 ? (
          <div>No replies</div>
        ) : !replies.loaded && repliesData == null ? (
          <button
            onClick={() => {
              fetcher.load(`/post/${parent_id}/${comment.id}`);
            }}
          >
            load {comment.numReplies} replies
          </button>
        ) : (
          repliesData?.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              parent_id={comment.id}
              replies={{
                loaded: false,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function Post() {
  const { post, rootComments } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1 className="text-xl">{post?.title}</h1>
      <div>
        {rootComments.map((comment) => (
          <Comment
            key={comment.id}
            parent_id={null}
            comment={{
              id: comment.id,
              body: comment.body,
              numReplies: comment.children.length,
            }}
            replies={{
              loaded: true,
              data: comment.children.map((reply) => ({
                id: reply.id,
                body: reply.body,
                numReplies: reply._count.children,
              }))!,
            }}
          />
        ))}
      </div>
    </div>
  );
}
