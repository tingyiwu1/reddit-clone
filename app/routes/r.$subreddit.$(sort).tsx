import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from '@remix-run/node';
import {
  Form,
  Link,
  useFetcher,
  useLoaderData,
  useParams,
} from '@remix-run/react';
import { prisma } from '~/db.server';
import { Post, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { useEffect, useState } from 'react';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  if (!params.subreddit) {
    return json([]);
  }
  const url = new URL(request.url);
  const skip = Number(url.searchParams.get('skip')) || 0;

  const orderBy =
    params.sort === 'new'
      ? Prisma.sql`p."created_utc" DESC`
      : Prisma.sql`p."score" DESC`;

  const posts = await prisma.$queryRaw<(Post & { numComments: number })[]>`
    SELECT p.*, (SELECT COUNT(*)::int FROM "Comment" c WHERE c."post_id" = p.id) as "numComments"
    FROM "Post" p
    WHERE p."subreddit" = ${params.subreddit}
    ORDER BY ${orderBy}
    LIMIT 20
    OFFSET ${skip}
  `;
  // const orderBy: Prisma.PostFindManyArgs['orderBy'] =
  //   params.sort === 'new' ? { created_utc: 'desc' } : { score: 'desc' };
  // const posts = await prisma.post.findMany({
  //   where: {
  //     subreddit: params.subreddit?.toLowerCase(),
  //   },
  //   include: {
  //     _count: {
  //       select: {
  //         comments: true,
  //       },
  //     },
  //   },
  //   orderBy,
  //   skip,
  //   take: 20,
  // });

  return json(posts);
};

const NewPostData = z.object({
  author: z.string(),
  over_18: z.optional(z.literal('on')),
  url: z.string(),
  selftext: z.string(),
  thumbnail: z.string(),
  title: z.string(),
});

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData();

  const parsed = NewPostData.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return json(parsed.error, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      author: parsed.data.author,
      over_18: parsed.data.over_18 ? true : false,
      selftext: parsed.data.selftext,
      thumbnail: parsed.data.thumbnail,
      title: parsed.data.title,
      created_utc: new Date(),
      score: 0,
      permalink: '',
      url: parsed.data.url,
      subreddit: params.subreddit ?? 'defaultsub',
    },
  });

  return redirect(`/post/${post.id}`);
};

export const scoreString = (score: number) => {
  if (score > 10000) {
    return (score / 1000).toFixed(1) + 'k';
  }
  return score.toString();
};

export default function Subreddit() {
  const params = useParams();
  const data = useLoaderData<typeof loader>();

  const [postsData, setPostsData] = useState(data);

  const [showNewPostForm, setShowNewPostForm] = useState(false);

  const fetcher = useFetcher<typeof loader>();

  useEffect(() => {
    if (fetcher.state === 'loading' || fetcher.data == null) {
      return;
    }
    const newPosts = fetcher.data;
    setPostsData((prev) => [...prev, ...newPosts]);
  }, [fetcher.data, fetcher.state]);

  return (
    <div>
      <div className="flex bg-sky-50 pb-1 pt-5">
        <div className=" p-2 text-3xl">r/{params.subreddit}</div>
      </div>
      <div className="flex gap-2 bg-gray-500 p-2">
        <div
          className={`px-2 py-1 ${params.sort == 'new' ? '' : 'bg-sky-500'}`}
        >
          <Link to={`/r/${params.subreddit}`} reloadDocument>
            <div className="text-white">Hot</div>
          </Link>
        </div>
        <div
          className={`px-2 py-1 ${params.sort == 'new' ? 'bg-sky-500' : ''}`}
        >
          <Link to={`/r/${params.subreddit}/new`} reloadDocument>
            <div className="text-white">New</div>
          </Link>
        </div>
        <button
          className="bg-sky-500 px-2 py-1 text-white"
          onClick={() => setShowNewPostForm(true)}
        >
          New Post
        </button>
      </div>
      {showNewPostForm && (
        <Form method="post">
          <div className="mx-4 mt-2 w-80 bg-gray-200 p-3">
            <div className="mb-3 text-center text-lg">New Post</div>
            <div className="mx-3 mb-2 flex items-center justify-between">
              <div>Title</div>
              <input type="text" name="title" required />
            </div>
            <div className="mx-3 mb-2 flex items-center justify-between">
              <div>URL</div>
              <input type="text" name="url" />
            </div>
            <div className="mx-3 mb-2 flex items-center justify-between">
              <div>Selftext</div>
              <input type="text" name="selftext" />
            </div>
            <div className="mx-3 mb-2 flex items-center justify-between">
              <div>Author</div>
              <input type="text" name="author" required />
            </div>
            <div className="mx-3 mb-2 flex items-center justify-between">
              <div>Thumbnail</div>
              <input type="text" name="thumbnail" />
            </div>
            <div className="mx-3 mb-2 flex items-center justify-between">
              <div>NSFW</div>
              <input type="checkbox" name="over_18" />
            </div>
            <input type="hidden" name="subreddit" value={params.subreddit} />
            <div className=" mx-3 mb-2 flex items-center justify-between">
              <div className="flex flex-grow justify-center">
                <button
                  className="bg-sky-500 px-2 py-1 text-white"
                  type="submit"
                >
                  Submit
                </button>
              </div>
              <div className="flex flex-grow justify-center">
                <button
                  className="bg-sky-500 px-2 py-1 text-white"
                  onClick={() => setShowNewPostForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Form>
      )}
      <div className="mx-4 mt-2">
        {postsData.map((post, index) => (
          <div
            className="mb-3 flex border border-gray-200 bg-gray-100"
            key={post.id}
          >
            <div className="w-10 flex-shrink-0 flex-col bg-white pt-2">
              <div className="text-center">{index + 1}</div>
            </div>
            <div className="w-20 flex-shrink-0 flex-col pt-2">
              <div className="text-center">{scoreString(post.score)}</div>
            </div>
            <div className="mr-2 w-20 flex-shrink-0 flex-col py-1">
              {post.thumbnail ? (
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
              <div className="text-sm text-gray-400">
                submitted {DateTime.fromISO(post.created_utc).toRelative()} by{' '}
                <span className="font-bold text-sky-900">{post.author}</span>
              </div>
              <Link className="hover:underline" to={`/post/${post.id}`}>
                <div>
                  <div className="text-sm font-bold text-gray-500">
                    {post.numComments} comments
                  </div>
                </div>
              </Link>
            </div>
          </div>
        ))}
        <button
          className="mb-3 hover:underline"
          onClick={() => {
            if (params.sort === 'new') {
              fetcher.load(
                `/r/${params.subreddit}/new?skip=${postsData.length}`,
              );
            } else {
              fetcher.load(`/r/${params.subreddit}?skip=${postsData.length}`);
            }
          }}
        >
          <div>
            <span className="text-sky-700">load more</span>
          </div>
        </button>
      </div>
      <div className="h-20" />
    </div>
  );
}
