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

onReady(): Here the program prepares the adapter:

- Start a instance of mySql
- Check the configuration of the adapter
- cerate Objects / States, if they are not existing yet
- !!!!Start intervals => not finished yet
  -- Reminders
  -- Sql reconnect
- connect to the telegram adapter (by IO-Broker objects)
- subscribe to States
  --Telegram
- ensure a connection to the mySql database
- createFolders for documents, if they are not existing

onStateChange(): This is the main Function for any incoming requests

- New telegram message
- Connection or connection lost to the telegram adapter

---

prepareRequest(): The incomming telegram message is processed:

- verify an existing mySql connection
- verify the user is listed in the adapter config
- get the user Cache from ioBroker State
- validateUserInput() => returns a valid command or if the first character of the return statement is '!': The command is not valid

    ########## Handling the Request: #############
    case MENU.xxx._: // If the user is in this menu
    if(command == MENU.yyy.\_text) // The user wants to go in the next menu
    newUserMenu = MENU.yyy._ // Set the new user menu => It is set to the ioBroker state at the end of this function

    else if(validInput) // If you need a number here: Is the command a number?
    userCache[MENU.xxx._] = command // Save the command in the userCache (ioBroker state) for later processing !Do not forget to clear the userCache, if you do not need it anymore!
    //Handle the command
    newUserMenu = MENU.zzz.\_ //ALWAYS set an new menu. if you do not have an new menu at the end of 'prepareRequest' you get an error
    break;
    ################################

- If there is a newuserMenu: sendMenuToUser()

sendMenuToUser(): Send the selected Menu in prepareRequest() to the user: All parameters of userCache can be used to create the text and keyboard of the "Answer"

- verify an existing mySql connection

    ########### Handling the Menu Output ############
    case MENU.xxx.\_ //If this menu should be displayed
    text.push('text') //The text to send to the user (each text.push() is a new line)
    keyboard = generateKeyboard() //The Keyboard to send to the user => Also look at generateNumberedChoiseKeyboard if you want a selection of numbers in your Keyboard
    break;
    ##################################

validateUserInput():

- verify an existing mySql connection
- Check if the command is in the necessary format for the specific MENU.xxx.\_

important async functions

- sendTextToUser(user, text)
- sendKeyboardToUser(user, text, keyboard) => 'keyboard' can be created by the following functions:
- sendFileToUser(user, filePath)
- updateFileSystem() => Create new Folders, if they are not exist The Date is used by Database
- getFiles(user, filePath) => return all filenames in this directory

important functions:

- createDateMod(yearMod, monthMod, dayMod) => return a date with an offset of the given Years, months, days
- textToDate(text) => converts 'heute' or 'gestern' to a date
- isInt(value) => returns true if value is int
- isFloat(value) => returns true if value is float
- generateKeyboard(arrValues, columns, menu) => "arrValues" and afterwards "menu" are converted in a array:[[],[]] with the amount of "columns"
- generateNumberedChoiseKeyboard(start, end, ...) => Used to generate a Number-selection-keyboard => See the function itself

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

### **WORK IN PROGRESS**

-(Thomas Kümmel)
-Add the "maintenance done" menu
-Changed the database column "Date" to "DateTime", because of time overlapping with maintenance calculations
-Audentification optimized: Only registered users can send messages
-Ensure the connection to the mySql Server every specified interval
-Handle recieved files /opt/iobroker/iobroker-data/telegram_1 => react to "requestRaw" of telegram adapter
-Function send files
-Send Files for Maintenance Tasks
-added program description to developer manual

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
