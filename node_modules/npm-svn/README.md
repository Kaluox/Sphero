# npm-svn

> Allow to install node modules from svn repos.

[![Dependency Status](https://david-dm.org/emolchanov/npm-svn.svg?style=flat-square)](https://david-dm.org/emolchanov/npm-svn)

[![NPM](https://nodei.co/npm/npm-svn.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/npm-svn/)

### WARNING

Installing this module **will** make changes to your project's package.json
file.

Installing this module via `npm install` will add an install hook to your
project's package.json. Once this hook is added any time your run `npm install`
for your project npm-svn looks through your package.json file for an
`svnDependencies` block where you can list your subversion stored node modules.

Result of each module setup is cached in module directory. 

To clean cache - remove `node_modules/npm-svn/.cache` file

## Getting Started

Make sure that you have ***svn command line tools***

Install with `npm install --save npm-svn`

```json
"dependencies": {
  "npm-svn": "latest"
}
```

After installing npm-svn you may use list dependencies from subversion
repositories in your `package.json` under a "svnDependencies" key. e.g.

```json
"svnDependencies": {
  "svn-module": "svn://path/to/svn/repo",
  "svn-module@tag": "svn://path/to/svn/repo",
  "svn-module@tag|revision": "svn://path/to/svn/repo",
}
```

## Documentation
When uninstalling this module make sure the install hook has been removed. This
should happend automatically when you `npm uninstall npm-svn` and only be
necessary if you manually uninstall the module by deleting the files and removing
entries from your package.json.

## Authentication
Use in package.json for adding custom options into svn cmd

```json
"svnOptions": {
  "username": "user",
  "password": "password",
  "no-auth-cache": true
}
```

## TODO
- refactoring
- svn tags path config
- tests
- console tools

## License
Copyright (c) 2015 Eugene A. Molchanov

Licensed under the ISC license.
