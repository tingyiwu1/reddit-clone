import { LoaderFunctionArgs, json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { prisma } from '~/db.server';
import { Prisma } from '@prisma/client';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const orderBy: Prisma.PostFindManyArgs['orderBy'] =
    params.sort === 'new' ? { created_utc: 'desc' } : { score: 'desc' };
  const posts = await prisma.post.findMany({
    where: {
      subreddit: params.subreddit,
    },
    orderBy,
    skip: 0,
    take: 20,
  });

  return json(posts);
};

export default function Subreddit() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <h1 className="bg-red-500 text-lg">Subreddit</h1>
      <ul>
        {data.map((post) => (
          <Link to={`/post/${post.id}`} key={post.id}>
            <li>{post.title}</li>
          </Link>
        ))}
      </ul>
    </div>
  );
}
