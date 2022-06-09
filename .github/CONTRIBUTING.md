# YAAW-for-Chrome Contributing Guide

Before contributing to YAAW-for-Chrome, please make sure to take a moment and read through the following guidelines.

- [JavaScript Standard Style](https://standardjs.com/)
- [Sass Guidelines](https://sass-guidelin.es/)


## Development Setup

Please make sure your [Node.js](http://nodejs.org) **version 16+** and [pnpm](https://pnpm.io) **version 6.32.4+**

After cloning the repo, run:

``` bash
$ pnpm install
$ pnpm dev
```

Now, you can load extension from `dist` fold. Gulp will watch and re-build the project.

If you want to package the extension. run:

``` bash
$ pnpm build
```

Gulp will generate compressed file in `dist` fold.
