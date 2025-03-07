![Logo](admin/sql-telegram-farm.jpg)

# ioBroker.sql-telegram-farm

[![NPM version](https://img.shields.io/npm/v/iobroker.sql-telegram-farm.svg)](https://www.npmjs.com/package/iobroker.sql-telegram-farm)
[![Downloads](https://img.shields.io/npm/dm/iobroker.sql-telegram-farm.svg)](https://www.npmjs.com/package/iobroker.sql-telegram-farm)
![Number of Installations](https://iobroker.live/badges/sql-telegram-farm-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/sql-telegram-farm-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.sql-telegram-farm.png?downloads=true)](https://nodei.co/npm/iobroker.sql-telegram-farm/)

**Tests:** ![Test and Release](https://github.com/TheThom/ioBroker.sql-telegram-farm/workflows/Test%20and%20Release/badge.svg)

## sql-telegram-farm adapter for ioBroker

Provide a telegram menu to operate a MySQL Database

## Developer manual

This section is intended for the developer. It can be deleted later.

### DISCLAIMER

This adapter is is programmed for an individual purpose. Do not use this adapter: It will not work for anyone.

### Getting started

### Scripts in `package.json`

Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `test:js` | Executes the tests you defined in `*.test.js` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |
| `translate` | Translates texts in your adapter to all required languages, see [`@iobroker/adapter-dev`](https://github.com/ioBroker/adapter-dev#manage-translations) for more details. |
| `release` | Creates a new release, see [`@alcalzone/release-script`](https://github.com/AlCalzone/release-script#usage) for more details. |

### Writing tests

When done right, testing code is invaluable, because it gives you the
confidence to change your code while knowing exactly if and when
something breaks. A good read on the topic of test-driven development
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92.
Although writing tests before the code might seem strange at first, but it has very
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter

Using GitHub Actions, you can enable automatic releases on npm whenever you push a new git tag that matches the form
`v<major>.<minor>.<patch>`. We **strongly recommend** that you do. The necessary steps are described in `.github/workflows/test-and-release.yml`.

Since you installed the release script, you can create a new
release simply by calling:

```bash
npm run release
```

Additional command line options for the release script are explained in the
[release-script documentation](https://github.com/AlCalzone/release-script#command-line).

To get your adapter released in ioBroker, please refer to the documentation
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually with dev-server

Since you set up `dev-server`, you can use it to run, test and debug your adapter.

You may start `dev-server` by calling from your dev directory:

```bash
dev-server watch
```

The ioBroker.admin interface will then be available at http://localhost:8081/

Please refer to the [`dev-server` documentation](https://github.com/ioBroker/dev-server#command-line) for more details.

## Changelog

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### 0.2.0 (2025-02-08)

- (Thomas Kümmel) -Put all sql actions in a seperate class and seperate file
  -Constants for MENU and SQL are also in seperate files
  -Machine Menu created: Use machine, History, basics for Maintenance

### 0.1.0 (2025-01-31)

- (Thomas Kümmel) Try to reconnect the database automatically + Edit Wood Menu + A lot of bug fixes

### 0.0.3 (2025-01-28)

- (Thomas Kümmel) Adapter state + depenecies updated

### 0.0.2 (2025-01-28)

- (Thomas Kümmel) initial release

## License

MIT License

Copyright (c) 2025 Thomas Kümmel <thomas.kuemmel@outlook.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
