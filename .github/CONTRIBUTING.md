# YAAW-for-Chrome Contributing Guide

Before contributing to YAAW-for-Chrome, please make sure to take a moment and read through the following guidelines.

- [JavaScript Standard Style](https://standardjs.com/)
- [Sass Guidelines](https://sass-guidelin.es/)


## Development Setup

Please make sure your [Node.js](http://nodejs.org) **version 8+** and [Yarn](https://yarnpkg.com) **version 1.13.0+**

After cloning the repo, run:

``` bash
$ yarn install
$ yarn dev
```

Now, you can load extension from `dist` fold. Gulp will watch and re-build the project.

If you want to package the extension. run:

``` bash
$ yarn build
```

Gulp will generate compressed file in `dist` fold.
