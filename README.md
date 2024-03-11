# GigaBrain Take-Home

## View website
https://reddit-clone-uxzp6ufd2q-uc.a.run.app/


## Documentation
### `/r/:subreddit`
- assigned features
  - sort by hot (highest score) or (new)
  - shows 20 posts with titles, scores, comment counts, and links
  - clicking `comments` in post navigates to `/post/postId`
  - create new post through `New Post` form
- additional features
  - `/r/all` shows posts from all subreddits (index also redirects here)
  - `load more` at the bottom loads 20 more posts at a time

### `/post/:postId`
- assigned features
  - shows title, score, image and selftext of post
    - button under post shows/hides image if post is image
  - shows all root comments and children on initial load
  - `load more comments` loads replies
  - create replies through `reply` form
- additional features
  - sort comments by hot or new
  - new replies (to comments) show up at top of list until page reload
    - new root comments go directly to correct spot; making this more user friendly (scroll to new comment maybe) is possible improvement

## Limitations/Improvement ideas
- long cold starts
- UX improvements 
  - loading states, button hover states, scroll to new comment
- more reddit features
  - paginate comments, hide comments, video player, view single comment's thread, sorting by rising, controversial, etc