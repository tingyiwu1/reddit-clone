import { LoaderFunctionArgs, json } from '@remix-run/node';
import {
  useLoaderData,
  useFetcher,
  useParams,
  Link,
  useSearchParams,
} from '@remix-run/react';
import { prisma } from '~/db.server';
import { useEffect, useRef, useState } from 'react';
import {
  loader as commentLoader,
  action as commentAction,
} from './post.$postId.$commentId';
import { Prisma } from '@prisma/client';
import { scoreString } from './r.$subreddit.$(sort)';
import { DateTime } from 'luxon';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const post = await prisma.post.findUnique({
    where: {
      id: params.postId,
    },
    include: {
      _count: {
        select: {
          comments: true,
        },
      },
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
  author: string;
  edited: boolean;
  created_utc: string;
  score: number;
};

type CommentProps = {
  comment: CommentData;
  preloadedReplies: CommentData[];
  level: number;
};

export function Comment({ comment, preloadedReplies, level }: CommentProps) {
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
      author: reply.author,
      edited: reply.edited,
      created_utc: reply.created_utc,
      score: reply.score,
      preloadedReplies: [],
    }));
    setRepliesData(repliesData);
    setShowReplyForm(false);
  }, [repliesFetcher.data, repliesFetcher.state]);

  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div
      className={`mx-2 mb-3 border border-gray-200 ${level % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
    >
      <div className="mx-5 my-3">
        <div>
          <span className="text-sm font-bold text-sky-900">
            {comment.author}
          </span>
          <span className="ml-2 text-sm text-gray-400">
            {' '}
            {scoreString(comment.score)} points
          </span>
          <span className="text-sm text-gray-400">
            {' '}
            {DateTime.fromISO(comment.created_utc).toRelative()}
            {comment.edited ? '*' : ''}
          </span>
        </div>
        <div>{comment.body}</div>
        <button
          className="hover:underline"
          onClick={() => setShowReplyForm(true)}
        >
          <span className="text-sm font-bold text-gray-500">reply</span>
        </button>
      </div>
      <div className="mx-3 mb-2">
        {showReplyForm && (
          <repliesFetcher.Form
            method="post"
            action={`/post/${params.postId}/${comment.id}?sort=${params.sort}`}
          >
            <input type="hidden" name="parent_id" value={comment.id} />
            <div className="mx-2 mb-2 flex-col">
              <div className="mb-1">
                <input
                  className="w-80 border border-gray-200"
                  type="text"
                  name="author"
                  placeholder="Author"
                  required
                />
              </div>
              <div className="">
                <textarea
                  className="h-20 w-80 border border-gray-200"
                  name="body"
                  placeholder="Type your comment here..."
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-sky-500 px-2 py-1 text-white"
                  type="submit"
                >
                  Save
                </button>
                <button
                  className="bg-red-500 px-2 py-1 text-white"
                  onClick={() => setShowReplyForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </repliesFetcher.Form>
        )}
      </div>
      <div className="pl-5">
        {repliesData.map((reply) => (
          <Comment
            key={reply.id}
            comment={reply}
            preloadedReplies={[]}
            level={level + 1}
          />
        ))}
        {comment.numReplies > 0 &&
          repliesData.length == 0 &&
          repliesFetcher.data == null && (
            <button
              className="mb-3 text-sm hover:underline"
              onClick={() => {
                repliesFetcher.load(
                  `/post/${params.postId}/${comment.id}?sort=${params.sort}`,
                );
              }}
            >
              <span className="text-sky-700">load more comments </span>
              <span className="text-gray-400">
                ({comment.numReplies} repl
                {comment.numReplies > 1 ? 'ies' : 'y'})
              </span>
            </button>
          )}
      </div>
    </div>
  );
}

export default function Post() {
  const { post, rootComments } = useLoaderData<typeof loader>();

  const params = useParams();

  const [searchParams] = useSearchParams();

  const replyFormFetcher = useFetcher<typeof commentAction>();

  const formRef = useRef<HTMLFormElement>(null);

  const [showImage, setShowImage] = useState(false);

  const hasImage = post?.url.search(/i.redd.it/) !== -1;

  useEffect(() => {
    if (replyFormFetcher.state === 'submitting') {
      formRef.current?.reset();
    }
  }, [replyFormFetcher.state]);

  if (post == null) {
    return <div>Post not found</div>;
  }

  return (
    <div>
      <div className="flex bg-sky-50 pb-1 pt-5">
        <div className=" p-2 text-3xl">
          <Link to={`/r/${post?.subreddit}`}>r/{post?.subreddit}</Link>
        </div>
      </div>
      <div className="flex gap-2 bg-gray-500 p-2">
        <div className={`bg-sky-500 px-2 py-1`}>
          <div className="text-white">Comments</div>
        </div>
      </div>
      <div className="mx-4 mb-3 flex border border-gray-200 bg-gray-100">
        <div className="w-20 flex-col pt-2">
          <div className="text-center">{scoreString(post.score)}</div>
        </div>
        <div className="mr-2 w-20 flex-col py-1">
          {post.thumbnail != 'self' ? (
            <img src={post.thumbnail} alt="" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gray-200 pt-4">
              <div className="text-center">...</div>
            </div>
          )}
        </div>
        <div>
          <div>
            <Link to={post.url || `/post/${post.id}`}>{post.title}</Link>
          </div>
          {post.selftext && (
            <div className='border border-gray-200 p-1 mr-2'>
              <div className='text-sm'>{post.selftext}</div>
            </div>
          )}
          <div className="flex items-center">
            {hasImage && (
              <div className="mr-1">
                <button
                  className="h-7 w-7 bg-gray-300 text-center text-white hover:bg-gray-500"
                  onClick={() => {
                    setShowImage((prev) => !prev);
                  }}
                >
                  {showImage ? 'x' : '>'}
                </button>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-400">
                submitted {DateTime.fromISO(post.created_utc).toRelative()} by{' '}
                <span className='font-bold text-sky-900'>{post.author}</span>
              </div>
              <Link to={`/post/${post.id}`}>
                <div>
                  <div className="text-sm font-bold text-gray-500">
                    {post._count.comments} comments
                  </div>
                </div>
              </Link>
            </div>
          </div>
          {showImage && (
            <div className="w-96">
              <img src={post.url} alt="" />
            </div>
          )}
        </div>
      </div>
      <div className="mx-4 border border-gray-200 bg-gray-100">
        <div className="flex gap-2 p-2">
          <div
            className={`px-2 py-1 ${!searchParams.get('sort') ? 'bg-sky-500' : 'bg-gray-500'}`}
          >
            <Link to={`/post/${post.id}`}>
              <div className="text-white">Hot</div>
            </Link>
          </div>
          <div
            className={`px-2 py-1 ${searchParams.get('sort') == 'new' ? 'bg-sky-500' : 'bg-gray-500'}`}
          >
            <Link to={`/post/${post.id}?sort=new`}>
              <div className="text-white">New</div>
            </Link>
          </div>
        </div>
        <replyFormFetcher.Form
          method="post"
          action={`/post/${post?.id}/${null}?sort=${params.sort}`}
          ref={formRef}
        >
          <div className="mx-2 mb-2 flex-col">
            <div className="mb-1">
              <input
                className="w-80 border border-gray-200"
                type="text"
                name="author"
                placeholder="Author"
                required
              />
            </div>
            <div className="">
              <textarea
                className="h-20 w-80 border border-gray-200"
                name="body"
                placeholder="Type your comment here..."
                required
              />
            </div>
            <input type="hidden" name="is_root" value="on" />
            <div>
              <button className="bg-sky-500 px-2 py-1 text-white" type="submit">
                Save
              </button>
            </div>
          </div>
        </replyFormFetcher.Form>
        <div>
          {rootComments.map((comment) => (
            <Comment
              key={comment.id}
              comment={{
                id: comment.id,
                body: comment.body,
                author: comment.author,
                edited: comment.edited,
                created_utc: comment.created_utc,
                score: comment.score,
                numReplies: comment.children.length,
              }}
              preloadedReplies={comment.children.map((reply) => ({
                id: reply.id,
                body: reply.body,
                author: reply.author,
                edited: reply.edited,
                created_utc: reply.created_utc,
                score: reply.score,
                numReplies: reply._count.children,
              }))}
              level={0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
