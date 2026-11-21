# Bug City

Bug City is a game in the planning stage: a mobile-first cooperative extraction game centered on a shared colony.

See [game requirements and delivery plan](docs/requirements.md) for the current vision, proposed first playable scope, technical investigation, and milestones toward a hosted playtest. Design choices marked as proposals remain open to playtesting.

## Deployment

GitHub Actions deploys the static contents of `public/` to GitHub Pages on every push to `main`; the workflow can also be run manually. The current page is a placeholder. When the game gains a build step, update the workflow to build and upload its output directory. In repository settings, Pages must use **GitHub Actions** as its source.
