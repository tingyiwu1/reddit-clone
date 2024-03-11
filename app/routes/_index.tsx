import { redirect, type MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { name: 'description', content: 'Welcome to Remix!' },
  ];
};

// home page redirects to /r/all
export const loader = () => redirect('/r/all');

export default function Index() {
  return <></>;
}
