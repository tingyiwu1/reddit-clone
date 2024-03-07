import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from '@remix-run/node';
import { Form, Link, useLoaderData, useParams } from '@remix-run/react';
import { prisma } from '~/db.server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.subreddit) {
    return json([]);
  }
  const orderBy: Prisma.PostFindManyArgs['orderBy'] =
    params.sort === 'new' ? { created_utc: 'desc' } : { score: 'desc' };
  const posts = await prisma.post.findMany({
    where: {
      subreddit: params.subreddit?.toLowerCase(),
    },
    include: {
      _count: {
        select: {
          comments: true,
        },
      },
    },
    orderBy,
    skip: 0,
    take: 20,
  });

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

export default function Subreddit() {
  const params = useParams();
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex bg-blue-300 pb-5 pt-5">
        <div className=" p-2 text-5xl">r/{params.subreddit}</div>
      </div>

      <Link to={`/r/${params.subreddit}`}>Hot</Link>
      <Link to={`/r/${params.subreddit}/new`}>New</Link>
      <Form method="post">
        title: <input type="text" name="title" required />
        url: <input type="text" name="url" />
        selftext: <input type="text" name="selftext" />
        author: <input type="text" name="author" required />
        thumbnail: <input type="text" name="thumbnail" />
        over_18: <input type="checkbox" name="over_18" />
        <input type="hidden" name="subreddit" value={params.subreddit} />
        <button type="submit">Submit</button>
      </Form>
      <div>
        {data.map((post) => (
          <Link to={`/post/${post.id}`} key={post.id}>
            <div>
              {post.title}
              <div>{post._count.comments} comments</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
