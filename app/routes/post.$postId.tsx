import { LoaderFunctionArgs, json } from '@remix-run/node';
import {
  useLoaderData,
  useFetcher,
  useParams,
  Link,
} from '@remix-run/react';
import { prisma } from '~/db.server';
import { useEffect, useState } from 'react';
import {
  loader as commentLoader,
  action as commentAction,
} from './post.$postId.$commentId';
import { Prisma } from '@prisma/client';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const post = await prisma.post.findUnique({
    where: {
      id: params.postId,
    },
  });

  const orderBy: Prisma.CommentFindManyArgs['orderBy'] =
    new URL(request.url).searchParams.get('sort') === 'new'
      ? { created_utc: 'desc' }
      : { score: 'desc' };

  const rootComments = await prisma.comment.findMany({
    where: {
      is_root: true,
      post_id: params.postId,
    },
    orderBy,
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
  preloadedReplies: CommentData[];
};

export function Comment({ comment, preloadedReplies }: CommentProps) {
  const params = useParams();

  const [repliesData, setRepliesData] =
    useState<CommentData[]>(preloadedReplies);

  const repliesFetcher = useFetcher<typeof commentLoader>();

  useEffect(() => {
    if (
      repliesFetcher.state === 'loading' ||
      repliesFetcher.data?.comment == null ||
      repliesFetcher.data?.replies == null
    ) {
      return;
    }
    console.log('repliesFetcher.data', repliesFetcher.data);
    const repliesData = repliesFetcher.data.replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      numReplies: reply._count.children,
      preloadedReplies: [],
    }));
    setRepliesData(repliesData);
  }, [repliesFetcher.data, repliesFetcher.state]);

  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div className="mb-10">
      <div>{comment.body}</div>
      <div>
        {showReplyForm ? (
          <repliesFetcher.Form
            method="post"
            action={`/post/${params.postId}/${comment.id}?sort=${params.sort}`}
          >
            <input type="hidden" name="parent_id" value={comment.id} />
            <input name="author" type="text" required />
            <textarea name="body" required />
            <button
              onClick={(e) => {
                e.preventDefault();
                repliesFetcher.submit(e.currentTarget, {
                  navigate: false,
                });
                setShowReplyForm(false);
              }}
            >
              submit
            </button>
            <button onClick={() => setShowReplyForm(false)}>cancel</button>
          </repliesFetcher.Form>
        ) : (
          <button onClick={() => setShowReplyForm(true)}>reply</button>
        )}
      </div>
      <div className="pl-5">
        {repliesData.map((reply) => (
          <Comment
            key={reply.id}
            comment={reply}
            preloadedReplies={[]}
          />
        ))}
        {comment.numReplies > 0 &&
          repliesData.length == 0 &&
          repliesFetcher.data == null && (
            <button
              onClick={() => {
                repliesFetcher.load(
                  `/post/${params.postId}/${comment.id}?sort=${params.sort}`,
                );
              }}
            >
              load more comments ({comment.numReplies} repl
              {comment.numReplies > 1 ? 'ies' : 'y'})
            </button>
          )}
      </div>
    </div>
  );
}

export default function Post() {
  const { post, rootComments } = useLoaderData<typeof loader>();

  const params = useParams();

  const replyFormFetcher = useFetcher<typeof commentAction>();
  return (
    <div>
      <h1 className="text-xl">{post?.title}</h1>
      <Link to={`/post/${post?.id}`}>Hot</Link>
      <Link to={`/post/${post?.id}?sort=new`}>New</Link>
      <replyFormFetcher.Form
        method="post"
        action={`/post/${post?.id}/${null}?sort=${params.sort}`}
      >
        <input type="text" name="author" required />
        <textarea name="body" required />
        <input type="hidden" name="is_root" value="on" />
        <button
          type="submit"
          onClick={(e) => {
            e.preventDefault();
            replyFormFetcher.submit(e.currentTarget, {
              navigate: false,
            });
          }}
        >
          submit
        </button>
      </replyFormFetcher.Form>
      <div>
        {rootComments.map((comment) => (
          <Comment
            key={comment.id}
            comment={{
              id: comment.id,
              body: comment.body,
              numReplies: comment.children.length,
            }}
            preloadedReplies={comment.children.map((reply) => ({
              id: reply.id,
              body: reply.body,
              numReplies: reply._count.children,
            }))}
          />
        ))}
      </div>
    </div>
  );
}
