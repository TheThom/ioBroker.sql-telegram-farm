'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

//const menu = require('./lib/menu.json');

//var xml = new XML(menu);

// Load your modules here, e.g.:
// const fs = require("fs");
let intervalEnsureConnection;
////let intervalMaintenanceReport;

const TELEGRAM_NODE = 'telegram.';
let telegramInstanceNode = 'telegram.0.';

//let tgInstancePath = 'telegram.0.'; //tg = Telegram
//let nodeTgConnection = 'telegram.0.info.connection';

//const func = require('./lib/functions');
const fs = require('fs');
////const schedule = require('node-schedule');
const mySql = require('./lib/mySql');
const MENU = require('./lib/menu.json');
const MYSQL = require('./lib/mySql.json');
const FOLDER = require('./lib/folder.json');

class SqlTelegramFarm extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'sql-telegram-farm',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
		this.sql = null;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 *
	 */
	async onReady() {
		// Initialize your adapter here
		this.sql = new mySql({ adapter: this });
		intervalEnsureConnection = setInterval(
			this.sql.mySqlEnsureConnection,
			this.config.database.intervalEnsureConnection * 60000,
		); //user input [min] interval [ms]

		/////////intervalMaintenanceReport = setInterval()
		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		//------------------------------------------------------
		if (this.config.telegram.users.length == 0) {
			this.log.error('There are no registered users in this instance');
			return;
		}
		for (const user of this.config.telegram.users) {
			await this.setObjectNotExistsAsync('users.' + user['name'] + '.menu', {
				type: 'state',
				common: {
					name: 'menu',
					type: 'string',
					role: 'text',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync('users.' + user['name'] + '.cache', {
				type: 'state',
				common: {
					name: 'cache',
					type: 'string',
					role: 'json',
					read: true,
					write: true,
				},
				native: {},
			});
		}

		await this.setObjectNotExistsAsync('nextMaintenanceReminder', {
			type: 'state',
			common: {
				name: 'nextMaintenanceReminder',
				type: 'number',
				role: 'value.time',
				read: true,
				write: false,
			},
			native: {},
		});
		const NextMaintenanceReminderTemp = await this.getStateAsync('nextMaintenanceReminder');
		const nextMaintenanceReminder = NextMaintenanceReminderTemp ? Number(NextMaintenanceReminderTemp.val) : 0;
		console.log(nextMaintenanceReminder);
		console.log(Date.now());
		if (this.config.machines.maintenanceReminderInterval != 0) {
			const configReminder = new Date(Date.now());
			configReminder.setDate(configReminder.getDate() + this.config.machines.maintenanceReminderInterval);
			configReminder.setUTCHours(Number(this.config.machines.maintenanceReminderHour));

			if (nextMaintenanceReminder < Date.now() || nextMaintenanceReminder > configReminder.valueOf()) {
				this.setState('nextMaintenanceReminder', configReminder.valueOf());
			}

			////			const jobMaintenanceReminder = schedule.scheduleJob(configReminder, function () {
			////				console.error('jobMaintenanceReminder executed');
			////			});
		}

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		//		this.subscribeStates('testVariable');

		telegramInstanceNode = TELEGRAM_NODE + this.config.telegram.instance + '.';
		this.getForeignState(telegramInstanceNode + 'info.connection', (err, state) => {
			if (err) {
				this.log.error('getForeignState - info.connection' + err);
				return;
			} else {
				if (!state) {
					this.log.error('Telegram instance: ' + this.config.telegram.instance + ' is not existing');
					return;
				} else {
					this.log.info('telegramState: ' + state.val);
				}
			}
		});
		await this.subscribeForeignStatesAsync(telegramInstanceNode + 'info.connection');
		await this.subscribeForeignStatesAsync(telegramInstanceNode + 'communicate.request');
		await this.subscribeForeignStatesAsync(telegramInstanceNode + 'communicate.pathFile');

		/*this.mySqlCon.config.host = this.config.database.server;
		this.mySqlCon.config.user = this.config.database.user;
		this.mySqlCon.config.password = this.config.database.password;
		this.mySqlCon.config.database = this.config.database.database;
*/

		await this.sql.mySqlEnsureConnection();

		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		// examples for the checkPassword/checkGroup functions
		//	let result = await this.checkPasswordAsync('admin', 'iobroker');
		//	this.log.info('check user admin pw iobroker: ' + result);

		//	result = await this.checkGroupAsync('admin', 'admin');
		//	this.log.info('check group user admin group admin: ' + result);

		////		if (!fs.existsSync(this.config.database.filepath + FOLDER.MACHINES.MAINTENANCE)) {
		////			fs.mkdirSync(this.config.database.filepath + FOLDER.MACHINES.MAINTENANCE);
		////		}

		await this.updateFileSystem('noUser');

		this.setState('info.connection', true, true);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			clearInterval(intervalEnsureConnection);
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		}
		if (id == telegramInstanceNode + 'communicate.request') {
			if (state?.val) {
				const STATEVAL = String(state.val);
				const user = STATEVAL.substring(1, STATEVAL.indexOf(']')); // Extract user from the message
				const command = STATEVAL.substring(STATEVAL.indexOf(']') + 1, STATEVAL.length); //Extract command/text form the message
				this.prepareRequest(user, command);
				//this.getForeignStateAsync(telegramInstanceNode + 'users' + user + 'menu');
			}
		} else if (id == telegramInstanceNode + 'communicate.pathFile') {
			if (state?.val) {
				const path = state.val;
				this.getForeignState(telegramInstanceNode + 'communicate.requestRaw', (err, requestRaw) => {
					if (err) {
						this.log.error('getForeignState - communicate.requestRaw' + err);
						return;
					} else {
						if (!state) {
							this.log.error('Telegram instance: ' + this.config.telegram.instance + ' is not existing');
							return;
						} else {
							const emtyRequestRaw = JSON.parse('{"from": {"first_name":"noUser"}}');
							const requestRawJSON = requestRaw ? JSON.parse(String(requestRaw.val)) : emtyRequestRaw;
							let user = 'noUser';
							try {
								user = requestRawJSON['from']['first_name'];
							} catch (err) {
								this.log.error('prepareRequest: UserCache could not read user Cache ' + err);
							}
							this.prepareRequest(user, path);
						}
					}
				});
			}
		} else if (id == telegramInstanceNode + 'info.connection') {
			if (state) {
				if (state.val) {
					this.log.info('Telegram is connected');
				} else {
					this.log.info('Telegram is not connected');
				}
			}
		}
	}

	async prepareRequest(user, command) {
		//let commandText = command.replace(/[^\x00-\xFF]/g,'').trim();                   //remove the emojis from the command (used to switch the command)
		//const commandText = command;
		if (!this.sql) {
			return;
		}
		console.log(this.config.telegram.users);
		let userExists = false;
		let userAdmin = false;
		for (const userTemp of this.config.telegram.users) {
			if (userTemp['name'] == user) {
				userAdmin = userTemp['admin'];
				userExists = true;
				break;
			}
		}
		if (!userExists) {
			this.sendTextToUser(user, 'Hello World');
			this.log.error('Invalid user "' + user + '" tried to send a message!');
			return;
		}

		const userMenuState = await this.getStateAsync('users.' + user + '.menu');
		let userMenuTemp = userMenuState ? String(userMenuState.val) : MENU._;
		let newUserMenu = '';
		const emtyUserCache = JSON.parse('{"emty": "true"}');
		const userCacheState = await this.getStateAsync('users.' + user + '.cache');
		let userCache = emtyUserCache;
		try {
			userCache = userCacheState ? JSON.parse(String(userCacheState.val)) : emtyUserCache;
			userCache[MENU.ADMIN._] = userAdmin;
		} catch (err) {
			this.log.error('prepareRequest: UserCache could not read user Cache ' + err);
		}

		this.log.debug('userMenu: "' + userMenuTemp + '" - userCache: "' + JSON.stringify(userCache) + '"');

		const validateInput = await this.validateUserInput(user, userMenuTemp, command, userCache); //true, if the input e.g. number is in the correct format. MENU.SPECIAL is handled below.
		let validInput = false;
		if (validateInput.substring(0, 1) != '!') {
			validInput = true;
			command = validateInput;
		}

		if (command == MENU._text || command == MENU._escape) {
			//If Main Menu is called: Always go to main menu; It doesn't matter in which menu you are at the moment
			userMenuTemp = MENU._;
			userCache = emtyUserCache;
		}
		const userMenu = userMenuTemp;

		switch (userMenu) {
			case MENU._:
				if (command == MENU.FIREWOOD._text) {
					newUserMenu = MENU.FIREWOOD._;
				} else if (command == MENU.MACHINES_CATEGORY._text) {
					newUserMenu = MENU.MACHINES_CATEGORY._;
				} else {
					newUserMenu = MENU._;
				}
				break;

			//#region Dialog
			case MENU.DIALOG.FILE._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = userCache[MENU.DIALOG.FILE.MENU_AT_EXIT];
				} else if (command == MENU.DIALOG.FILE.ADD_FILE._text) {
					newUserMenu = MENU.DIALOG.FILE.ADD_FILE._;
				} else if (validInput) {
					await this.sendFileToUser(
						user,
						FOLDER.MACHINES.MAINTENANCE + userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._],
					);
					newUserMenu = MENU.DIALOG.FILE.ADD_FILE._;
				}
				break;

			case MENU.DIALOG.FILE.ADD_FILE._:
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = userCache[MENU.DIALOG.FILE.MENU_AT_EXIT];
				} else if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.DIALOG.FILE._;
				} else if (validInput) {
					userCache[MENU.DIALOG.FILE.ADD_FILE._path] = command;
					newUserMenu = MENU.DIALOG.FILE.ADD_FILE.NAME._;
				}
				break;

			case MENU.DIALOG.FILE.ADD_FILE.NAME._:
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.DIALOG.FILE._;
					userCache[MENU.DIALOG.FILE.ADD_FILE.NAME._] = '';
					userCache[MENU.DIALOG.FILE.ADD_FILE._path] = '';
				} else if (validInput) {
					const destinationPath = this.config.database.filepath + userCache[MENU.DIALOG.FILE.FILE_PATH];
					const destinationFileName =
						command + '.' + userCache[MENU.DIALOG.FILE.ADD_FILE._path].split('.').pop();
					if (
						await this.moveFile(
							user,
							userCache[MENU.DIALOG.FILE.ADD_FILE._path],
							destinationPath,
							destinationFileName,
						)
					) {
						this.sendTextToUser('Datei "' + command + '" erfolgreich übernommen');
						userCache[MENU.DIALOG.FILE.FILE_COUNT] = userCache[MENU.DIALOG.FILE.FILE_COUNT] + 1;
					}
					userCache[MENU.DIALOG.FILE.ADD_FILE.NAME._] = '';
					userCache[MENU.DIALOG.FILE.ADD_FILE._path] = '';
					newUserMenu = MENU.DIALOG.FILE._;
				}
				break;

			//#endregion
			// #region FIREWOOD
			case MENU.FIREWOOD._:
				if (command == MENU.FIREWOOD.NEW._text) {
					userCache = emtyUserCache;
					newUserMenu = MENU.FIREWOOD.NEW.NUMBER;
				} else if (command == MENU.FIREWOOD.EDIT._text) {
					newUserMenu = MENU.FIREWOOD.EDIT.NUMBER._;
				} else if (command == MENU.FIREWOOD.STATUS._text) {
					newUserMenu = MENU.FIREWOOD._;
					this.sendTextToUser(user, await this.sql.get(user, MYSQL.GET.FIREWOOD.STATUS));
				} else {
					newUserMenu = MENU._;
				}
				break;
			// #region FIREWOOD.New
			case MENU.FIREWOOD.NEW.NUMBER: //Sequence - 1 - Number
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.FIREWOOD._;
					userCache = emtyUserCache;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.NUMBER] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT;
				}
				break;
			case MENU.FIREWOOD.NEW.AMOUNT: //Sequence - 2 - Amount
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.NUMBER;
					userCache = emtyUserCache;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.AMOUNT] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT_DETAILED;
				}
				break;
			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED: //Sequence - 3 - Amount Detailed
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.AMOUNT_DETAILED] = parseFloat(command);
					newUserMenu = MENU.FIREWOOD.NEW.TYPE;
				}
				break;
			case MENU.FIREWOOD.NEW.TYPE: //Sequence - 4 - Type
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT_DETAILED;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.TYPE] = command;
					newUserMenu = MENU.FIREWOOD.NEW.HUMIDITY;
				}
				break;
			case MENU.FIREWOOD.NEW.HUMIDITY: //Sequence - 5 - Humidity
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.TYPE;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.HUMIDITY] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.DATE;
				}
				break;
			case MENU.FIREWOOD.NEW.DATE: //Sequence - 6 - Date
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.HUMIDITY;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.DATE] = textToDate(command);
					newUserMenu = MENU.FIREWOOD.NEW.LOCATION;
				}
				break;
			case MENU.FIREWOOD.NEW.LOCATION: //Sequence - 7 - Location
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.DATE;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.LOCATION] = command;
					newUserMenu = MENU.FIREWOOD.NEW.NOTES;
				}
				break;
			case MENU.FIREWOOD.NEW.NOTES: //Sequence - 8 - Notes
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.LOCATION;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.NOTES] = command;
					newUserMenu = MENU.FIREWOOD.NEW.REVIEW;
				}
				break;
			case MENU.FIREWOOD.NEW.REVIEW: //Sequence - 9 - Review
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.NOTES;
				} else if (command == MENU.SPECIALS.ABORT) {
					userCache = emtyUserCache;
					newUserMenu = MENU.FIREWOOD._;
				} else if (command == MENU.SPECIALS.SAVE) {
					if (await this.sql.set(user, MYSQL.SET.FIREWOOD.SAVE_NEW, userCache)) {
						this.sendTextToUser(user, 'Neuer Eintrag wurde erfolgreich gespeichert');
						userCache = emtyUserCache;
						newUserMenu = MENU.FIREWOOD._;
					} else {
						newUserMenu = MENU.FIREWOOD.NEW.REVIEW;
					}
				}

				break;
			// #endregion
			// #region FIREWOOD.Edit
			case MENU.FIREWOOD.EDIT.NUMBER._:
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.FIREWOOD._;
					userCache = emtyUserCache;
				} else if (validInput) {
					userCache = await this.sql.get(user, MYSQL.GET.FIREWOOD.DATASET_BY_NUMBER, command);
					newUserMenu = MENU.FIREWOOD.EDIT._;
				}
				break;
			case MENU.FIREWOOD.EDIT._: {
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.FIREWOOD._;
					userCache = emtyUserCache;
				} else if (command == MENU.SPECIALS.SAVE) {
					if (await this.sql.set(user, MYSQL.SET.FIREWOOD.SAVE_EDIT, userCache)) {
						this.sendTextToUser(user, 'Eintrag wurde erfolgreich geändert');
						userCache = emtyUserCache;
						newUserMenu = MENU.FIREWOOD._;
					} else {
						newUserMenu = MENU.FIREWOOD.EDIT._;
					}
					userCache = emtyUserCache;
				} else if (command.includes(MENU.FIREWOOD.EDIT.ID._text)) {
					newUserMenu = userMenu;
					this.sendTextToUser(user, 'Die Id kann nicht bearbeitet werden');
				} else if (command.includes(MENU.FIREWOOD.EDIT.NUMBER._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.NUMBER.CHANGE;
				} else if (command.includes(MENU.FIREWOOD.EDIT.TYPE._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.TYPE._;
				} else if (command.includes(MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.AMOUNT;
				} else if (command.includes(MENU.FIREWOOD.EDIT.HUMIDITY._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.HUMIDITY._;
				} else if (command.includes(MENU.FIREWOOD.EDIT.LOCATION._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.LOCATION._;
				} else if (command.includes(MENU.FIREWOOD.EDIT.NOTES._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.NOTES._;
				} else if (command.includes(MENU.FIREWOOD.EDIT.DELETE._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.DELETE._;
				}
				break;
			}
			case MENU.FIREWOOD.EDIT.NUMBER.CHANGE:
			case MENU.FIREWOOD.EDIT.TYPE._:
			case MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._:
			case MENU.FIREWOOD.EDIT.HUMIDITY._:
			case MENU.FIREWOOD.EDIT.LOCATION._:
			case MENU.FIREWOOD.EDIT.NOTES._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.EDIT._;
				} else if (validInput) {
					userCache[userMenu] = command;
					newUserMenu = MENU.FIREWOOD.EDIT._;
				}
				break;
			case MENU.FIREWOOD.EDIT.AMOUNT:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.EDIT._;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.EDIT.AMOUNT] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._;
				}
				break;
			case MENU.FIREWOOD.EDIT.DELETE._:
				if (command == MENU.SPECIALS.DELETE) {
					userCache[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._] = 0;
					if (await this.sql.set(user, MYSQL.SET.FIREWOOD.SAVE_EDIT, userCache)) {
						if (await this.sql.set(user, MYSQL.SET.FIREWOOD.DELETE, userCache)) {
							this.sendTextToUser(user, 'Eintrag wurde erfolgreich gelöscht');
							userCache = emtyUserCache;
							newUserMenu = MENU.FIREWOOD._;
						} else {
							newUserMenu = MENU.FIREWOOD.EDIT._;
						}
					} else {
						newUserMenu = MENU.FIREWOOD.EDIT._;
					}
				} else {
					newUserMenu = MENU.FIREWOOD.EDIT._;
				}
				break;
			//#endregion
			//#endregion
			//#region MACHINES
			case MENU.MACHINES_CATEGORY._:
				if (command == MENU.SPECIALS.MAIN_MENU) {
					newUserMenu = MENU._;
					userCache = emtyUserCache;
				} else if (command == MENU.MACHINES_CATEGORY.EVALUATION._text) {
					this.sendTextToUser(user, await this.sql.get(user, MYSQL.GET.MACHINES.MAINTENANCE.TODO));
					newUserMenu = MENU.MACHINES_CATEGORY._;
				} else if (validInput) {
					userCache[MENU.MACHINES_CATEGORY._] = command;
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE._;
				}
				break;
			case MENU.MACHINES_CATEGORY.MACHINE._:
				if (command == MENU.SPECIALS.BACK) {
					userCache = emtyUserCache;
					newUserMenu = MENU.MACHINES_CATEGORY._;
				} else if (validInput) {
					userCache[MENU.MACHINES_CATEGORY.MACHINE._] = command;
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._;
				}
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._:
				if (command == MENU.SPECIALS.ABORT) {
					userCache = emtyUserCache;
					newUserMenu = MENU.MACHINES_CATEGORY._;
				} else if (command == MENU.SPECIALS.BACK) {
					const tempUserCache = userCache[MENU.MACHINES_CATEGORY._]; //Delete UserCache except the selected GROUP
					userCache = emtyUserCache;
					userCache[MENU.MACHINES_CATEGORY._] = tempUserCache;
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE._;
				} else if (command == MENU.MACHINES_CATEGORY.MACHINE.HISTORY._text) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.HISTORY._;
				} else if (command == MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._text) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._;
				} else if (validInput) {
					userCache[MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._] = command;
					if (await this.sql.set(user, MYSQL.SET.MACHINES.ADD_USE, userCache)) {
						this.sendTextToUser(user, 'Eintrag wurde erfolgreich geändert');
						userCache = emtyUserCache;
						newUserMenu = MENU.MACHINES_CATEGORY._;
					} else {
						newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._;
					}
				}
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.HISTORY._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._;
				}
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._;
				} else if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.MACHINES_CATEGORY._;
					userCache = emtyUserCache;
				} else if (validInput) {
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._] = command;
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] = await this.sql.get(
						user,
						MYSQL.GET.MACHINES.MAINTENANCE.ID,
						userCache,
					);
					//		await this.sendFileToUser(
					//			user,
					//			FOLDER.MACHINES.MAINTENANCE +
					//				(await this.sql.get(user, MYSQL.GET.MACHINES.MAINTENANCE.ID, userCache)),
					//		);

					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._;
				} else if (command == MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._textNew) {
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] = await this.sql.get(
						user,
						MYSQL.GET.MACHINES.MAINTENANCE.FREE_ID,
						userCache,
					);
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._] = '-';
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._] = '-';
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._] = 1;
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._] = '0';
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._] = '0';
					userCache[MENU.DIALOG.FILE.FILE_COUNT] = '0';
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._;
				}
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._;
				} else if (command == MENU.SPECIALS.SAVE) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.NOTE._;
				} else if (command == MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._text) {
					const dataset = await this.sql.get(user, MYSQL.GET.MACHINES.MAINTENANCE.DATASET_BY_ID, userCache);
					userCache = datasetToUserCash(userCache, dataset);
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._;
				} else if (validInput) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._;
					await this.sendFileToUser(user, command);
				}
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.NOTE._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._;
				} else if (validInput) {
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.NOTE._] = command;
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.DONE._;
				}
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.DONE._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._;
				} else if (command == MENU.SPECIALS.SAVE) {
					if (await this.sql.set(user, MYSQL.SET.MACHINES.MAINTENANCE.DONE, userCache)) {
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.NOTE._] = 'null';
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._] = 'null';
						this.sendTextToUser(user, 'Neuer Eintrag wurde erfolgreich gespeichert');
					}
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._;
				}
				break;

			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._:
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.MACHINES_CATEGORY._;
					userCache = emtyUserCache;
				} else if (command == MENU.SPECIALS.SAVE) {
					if (await this.sql.set(user, MYSQL.SET.MACHINES.MAINTENANCE.SAVE_EDIT, userCache)) {
						this.sendTextToUser(user, 'Eintrag wurde erfolgreich geändert');
						await this.updateFileSystem(user);
						userCache = emtyUserCache;
						newUserMenu = MENU.MACHINES_CATEGORY._;
					} else {
						this.sendTextToUser(user, '!Fehler beim Speichern in die Datenbank');
						newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._;
						break;
					}
					userCache = emtyUserCache;
				} else if (command.includes(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._text)) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._;
				} else if (command.includes(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._text)) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._;
				} else if (command.includes(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._text)) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._;
				} else if (command.includes(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._text)) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._;
				} else if (command.includes(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._text)) {
					if (userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._]) {
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._] = 0;
					} else {
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._] = 1;
					}
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._;
				} else if (command.includes(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.FILE_COUNT._text)) {
					userCache[MENU.DIALOG.FILE.MENU_AT_EXIT] = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._;
					userCache[MENU.DIALOG.FILE.FILE_PATH] =
						FOLDER.MACHINES.MAINTENANCE + userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] + '/';
					userCache[MENU.DIALOG.FILE.ENABLE_ADD_FILE] = MENU.ADMIN._;
					userCache[MENU.DIALOG.FILE.USER_TEXT] =
						userCache[MENU.MACHINES_CATEGORY.MACHINE._] +
						' - ' +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] +
						' - Wartungspläne';
					newUserMenu = MENU.DIALOG.FILE._;
				}
				break;

			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._;
				} else if (validInput) {
					userCache[userMenu] = command;
					newUserMenu = MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._;
				}
				break;

			default:
				if (command == MENU._text) {
					newUserMenu = MENU._;
					this.sendMenuToUser(user, MENU._);
				}
				break;

			//#endregion
		}
		if (newUserMenu) {
			this.sendMenuToUser(user, newUserMenu, userCache);
		} else {
			if (!validInput) {
				this.sendTextToUser(user, validateInput);
				newUserMenu = userMenu;
			} else {
				const WARNING =
					'prepareRequest - \r\nrequest: "' +
					command +
					'" could not be handled;\r\n User: "' +
					user +
					'",\r\n Menu: "' +
					userMenu +
					'",\r\n\r\n cache: "' +
					JSON.stringify(userCache);
				newUserMenu = MENU._;
				userCache = emtyUserCache;
				this.log.warn(WARNING);
				await this.sendTextToUser(user, WARNING);
				await this.sendMenuToUser(user, MENU._, userCache);
			}
		}
		this.log.debug('users.' + user + '.menu: ' + newUserMenu);
		await this.setState('users.' + user + '.menu', { val: newUserMenu, ack: true });
		//console.warn(userCache);
		//console.warn(JSON.stringify(userCache));
		await this.setState('users.' + user + '.cache', { val: JSON.stringify(userCache), ack: true });
	}

	async sendMenuToUser(user, menu, userCache) {
		if (!this.sql) {
			return;
		}
		let keyboard = [];
		const text = [' '];
		switch (menu) {
			case MENU._:
				text.push(MENU._text);
				keyboard.push([MENU.FIREWOOD._text]);
				keyboard.push([MENU.MACHINES_CATEGORY._text]);
				if (userCache[MENU.ADMIN._]) {
					keyboard.push([MENU.ADMIN._textTrue]);
				} else {
					keyboard.push([MENU.ADMIN._textFalse]);
				}
				break;
			//#region Dialog
			case MENU.DIALOG.FILE._: {
				text.push(userCache[MENU.DIALOG.FILE.USER_TEXT]);
				const result = await this.getFiles(user, userCache[MENU.DIALOG.FILE.FILE_PATH]);
				for (const res in result) {
					keyboard.push([result[res]]);
				}
				if (userCache[MENU.DIALOG.FILE.ENABLE_ADD_FILE]) {
					keyboard.push([MENU.DIALOG.FILE.ADD_FILE._text]);
				}
				keyboard.push([MENU.SPECIALS.BACK]);
				break;
			}
			case MENU.DIALOG.FILE.ADD_FILE._:
				text.push(userCache[MENU.DIALOG.FILE.USER_TEXT] + ' - Neue Datei in diesen Chat schicken');
				keyboard.push([MENU.SPECIALS.BACK]);
				keyboard.push([MENU.SPECIALS.ABORT]);
				break;

			case MENU.DIALOG.FILE.ADD_FILE.NAME._:
				text.push(MENU.DIALOG.FILE.ADD_FILE.NAME._text);
				keyboard.push([MENU.SPECIALS.ABORT]);
				break;

			//#endregion
			//#region FIREWOOD
			case MENU.FIREWOOD._:
				text.push(MENU.FIREWOOD._text);
				keyboard.push([MENU._text]);
				keyboard.push([MENU.FIREWOOD.STATUS._text]);
				keyboard.push([MENU.FIREWOOD.NEW._text]);
				keyboard.push([MENU.FIREWOOD.EDIT._text]);
				break;
			case MENU.FIREWOOD.NEW.NUMBER:
			case MENU.FIREWOOD.EDIT.NUMBER.CHANGE: {
				const result = await this.sql.get(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
				const arrAnswers = [];
				let resultCount = 0;
				let answersCount = 0;
				let testedInt = 1;
				while (answersCount < 20) {
					//Generate 20 free numers, that are not active in use
					if (result[resultCount] != String(testedInt)) {
						arrAnswers[answersCount] = testedInt;
						answersCount++;
					} else if (result[resultCount] == String(testedInt) && result.length > resultCount + 1) {
						resultCount++;
					}
					testedInt++;
				}
				text.push('Welche Nummer wurde angebracht?');
				keyboard = generateKeyboard(arrAnswers, 3, MENU.SPECIALS.ABORT);
				break;
			}
			case MENU.FIREWOOD.EDIT.NUMBER._: {
				const result = await this.sql.get(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
				text.push('Welche Nummer wurde angebracht?');
				keyboard = generateKeyboard(result, 3, MENU.SPECIALS.ABORT);
				break;
			}
			case MENU.FIREWOOD.EDIT._: {
				text.push('Holz Nr. ' + userCache[MENU.FIREWOOD.EDIT.NUMBER._] + ' bearbeiten');
				keyboard.push([
					MENU.FIREWOOD.EDIT.ID._text + userCache[MENU.FIREWOOD.EDIT.ID._],
					MENU.FIREWOOD.EDIT.NUMBER._text + userCache[MENU.FIREWOOD.EDIT.NUMBER.CHANGE],
					MENU.FIREWOOD.EDIT.TYPE._text + userCache[MENU.FIREWOOD.EDIT.TYPE._],
				]);
				keyboard.push([
					MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._text +
						userCache[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._] +
						'[Ster]',
				]);
				keyboard.push([MENU.FIREWOOD.EDIT.HUMIDITY._text + userCache[MENU.FIREWOOD.EDIT.HUMIDITY._] + '%']);
				keyboard.push([MENU.FIREWOOD.EDIT.LOCATION._text + userCache[MENU.FIREWOOD.EDIT.LOCATION._]]);
				keyboard.push([MENU.FIREWOOD.EDIT.NOTES._text + userCache[MENU.FIREWOOD.EDIT.NOTES._]]);
				keyboard.push([MENU.FIREWOOD.EDIT.DELETE._text]);
				keyboard.push([MENU.SPECIALS.SAVE, MENU.SPECIALS.ABORT]);
				break;
			}
			case MENU.FIREWOOD.NEW.AMOUNT:
			case MENU.FIREWOOD.EDIT.AMOUNT:
				text.push('Menge in Ster');
				keyboard = generateNumberedChoiseKeyboard(0, 20, 1, '', '', 3, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED:
			case MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._:
				text.push('Detaillierte Menge in Ster');
				keyboard = generateNumberedChoiseKeyboard(
					0,
					75,
					25,
					(userCache[MENU.FIREWOOD.NEW.AMOUNT] || userCache[MENU.FIREWOOD.EDIT.AMOUNT]) + '.',
					'',
					2,
					MENU.SPECIALS.BACK,
				);
				break;
			case MENU.FIREWOOD.NEW.TYPE:
			case MENU.FIREWOOD.EDIT.TYPE._:
				text.push('Holzart');
				keyboard = generateKeyboard(
					await this.sql.get(user, MYSQL.GET.FIREWOOD.VALID_TYPES),
					2,
					MENU.SPECIALS.BACK,
				);
				break;
			case MENU.FIREWOOD.NEW.HUMIDITY:
			case MENU.FIREWOOD.EDIT.HUMIDITY._:
				text.push('Feuchtigkeit in %');
				keyboard = generateNumberedChoiseKeyboard(5, 30, 1, '', '%', 5, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.DATE:
				text.push('Anlage / Änderungsdatum');
				keyboard = generateKeyboard(
					['heute', 'letzteWoche', 'letztenMonat', 'letztesJahr', MENU.SPECIALS.BACK],
					1,
				);
				break;
			case MENU.FIREWOOD.NEW.LOCATION:
			case MENU.FIREWOOD.EDIT.LOCATION._:
				text.push('Lagerort');
				keyboard = generateKeyboard(
					await this.sql.get(user, MYSQL.GET.FIREWOOD.VALID_LOCATIONS),
					2,
					MENU.SPECIALS.BACK,
				);
				break;
			case MENU.FIREWOOD.NEW.NOTES:
			case MENU.FIREWOOD.EDIT.NOTES._:
				text.push('Notizen (optional)');
				keyboard = generateKeyboard([MENU.SPECIALS.SKIP, MENU.SPECIALS.BACK], 1);
				break;
			case MENU.FIREWOOD.NEW.REVIEW:
				text[0] = 'Zusammenfassung';
				text[1] = 'Nr.           : ' + userCache[MENU.FIREWOOD.NEW.NUMBER];
				text[2] = 'Menge    : ' + userCache[MENU.FIREWOOD.NEW.AMOUNT_DETAILED] + '[Ster]';
				text[3] = 'Art           : ' + userCache[MENU.FIREWOOD.NEW.TYPE];
				text[4] = 'Feuchte  : ' + userCache[MENU.FIREWOOD.NEW.HUMIDITY] + '%';
				text[5] = 'Lagerort : ' + userCache[MENU.FIREWOOD.NEW.LOCATION];
				text[6] = 'Erstellt    : ' + userCache[MENU.FIREWOOD.NEW.DATE];
				text[7] = 'Notiz       : ' + userCache[MENU.FIREWOOD.NEW.NOTES];
				keyboard = generateKeyboard([MENU.SPECIALS.SAVE, MENU.SPECIALS.BACK, MENU.SPECIALS.ABORT], 1);
				break;

			case MENU.FIREWOOD.EDIT.DELETE._:
				text[0] = 'Soll das Holz wirklich gelöscht werden?';
				text[1] = 'Nr.           : ' + userCache[MENU.FIREWOOD.EDIT.NUMBER._];
				text[2] = 'Menge    : ' + userCache[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._] + '[Ster]';
				text[3] = 'Art           : ' + userCache[MENU.FIREWOOD.EDIT.TYPE._];
				text[4] = 'Feuchte  : ' + userCache[MENU.FIREWOOD.EDIT.HUMIDITY._] + '%';
				text[5] = 'Lagerort : ' + userCache[MENU.FIREWOOD.EDIT.LOCATION._];
				text[6] = 'Erstellt    : ' + userCache[MENU.FIREWOOD.EDIT.DATE];
				text[7] = 'Notiz       : ' + userCache[MENU.FIREWOOD.EDIT.NOTES._];
				keyboard = generateKeyboard([MENU.SPECIALS.BACK, MENU.SPECIALS.ABORT, MENU.SPECIALS.DELETE], 1);

				break;

			//#endregion
			//#region MACHINES
			case MENU.MACHINES_CATEGORY._:
				text.push('Maschinen Gruppe');
				keyboard = generateKeyboard(await this.sql.get(user, MYSQL.GET.MACHINES.CATEGORY), 1, [
					MENU.MACHINES_CATEGORY.EVALUATION._text,
					MENU.SPECIALS.MAIN_MENU,
				]);
				break;
			case MENU.MACHINES_CATEGORY.MACHINE._:
				text.push('Maschine');
				keyboard = generateKeyboard(
					await this.sql.get(user, MYSQL.GET.MACHINES.MACHINES, userCache),
					1,
					MENU.SPECIALS.BACK,
				);
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._: {
				const hourMeterOffset = await this.sql.get(user, MYSQL.GET.MACHINES.HOUR_METER_OFFSET, userCache);

				if (hourMeterOffset > 0) {
					text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE._] + ' - Wert des Stundenzählers eingeben');
					keyboard = generateKeyboard(
						[MENU.MACHINES_CATEGORY.MACHINE.HISTORY._text, MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._text],
						1,
						[MENU.SPECIALS.BACK, MENU.SPECIALS.ABORT],
					);
				} else {
					text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE._] + ' - Verwendung in Stunden');
					keyboard = generateNumberedChoiseKeyboard(0.5, 8, 0.5, '', '', 4, [
						MENU.MACHINES_CATEGORY.MACHINE.HISTORY._text,
						MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._text,
						MENU.SPECIALS.BACK,
						MENU.SPECIALS.ABORT,
					]);
				}

				break;
			}
			case MENU.MACHINES_CATEGORY.MACHINE.HISTORY._:
				this.sendTextToUser(user, await this.sql.get(user, MYSQL.GET.MACHINES.HISTORY, userCache));
				text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE._] + ' - Historie');
				keyboard = generateKeyboard([MENU.SPECIALS.BACK], 1);
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._: {
				const keyboardOptions = [];
				if (userCache[MENU.ADMIN._]) {
					keyboardOptions.push(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._textNew);
				}
				keyboardOptions.push(MENU.SPECIALS.BACK);
				keyboardOptions.push(MENU.SPECIALS.ABORT);

				text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE._] + ' - Wartung durchführen:');
				keyboard = generateKeyboard(
					await this.sql.get(user, MYSQL.GET.MACHINES.MAINTENANCE.MAINTENANCE, userCache),
					1,
					keyboardOptions,
				);
				break;
			}

			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._: {
				const keyboardOptions = [];
				if (userCache[MENU.ADMIN._]) {
					keyboardOptions.push(MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._text);
				}
				keyboardOptions.push(MENU.SPECIALS.SAVE);
				keyboardOptions.push(MENU.SPECIALS.BACK);

				text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE._] + ':');
				text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._]);
				text.push(await this.sql.get(user, MYSQL.GET.MACHINES.MAINTENANCE.DESCRIPTION, userCache));
				keyboard = generateKeyboard(
					await this.getFiles(
						user,
						FOLDER.MACHINES.MAINTENANCE + userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._],
					),
					1,
					keyboardOptions,
				);
				break;
			}
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.NOTE._: {
				text.push(
					userCache[MENU.MACHINES_CATEGORY.MACHINE._] +
						' - ' +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._],
				);
				text.push('Notiz hinzufügen und speichern');
				keyboard = generateKeyboard([MENU.SPECIALS.SAVE, MENU.SPECIALS.BACK], 1);

				break;
			}
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.DONE._: {
				if (await this.sql.set(user, MYSQL.SET.MACHINES.MAINTENANCE.DONE, userCache)) {
					text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE._] + ':');
					text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._]);
					text.push('wurde durchgeführt');
				} else text.push('Fehler beim Erstellen der Wartung!!');
				keyboard = generateKeyboard([MENU.SPECIALS.BACK], 1);
				break;
			}
			//#region Edit Maintenance
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT._: {
				userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.FILE_COUNT._] = await this.getFileCount(
					//handled here and not in prepareRequest, because there is also a link from File dialog
					user,
					FOLDER.MACHINES.MAINTENANCE + userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._],
				);

				text.push(
					'Wartung: "' +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._] +
						'" bearbeiten',
				);
				keyboard.push([
					MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._text +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._],
				]);
				keyboard.push([
					MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._text +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._].substring(0, 20) +
						' ...',
				]);
				keyboard.push([
					MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._text +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._],
				]);
				keyboard.push([
					MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._text +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._],
				]);
				let activ = 'nein';
				if (userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._]) {
					activ = 'ja';
				}
				keyboard.push([MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._text + activ]);

				keyboard.push([
					MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.FILE_COUNT._text +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.FILE_COUNT._],
				]);
				keyboard.push([MENU.SPECIALS.SAVE, MENU.SPECIALS.ABORT]);
				break;
			}
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._:
				text.push('Titel bearbeiten - original:');
				text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._]);
				keyboard = generateKeyboard([MENU.SPECIALS.BACK], 1);
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._:
				text.push('Beschreibung bearbeiten - original:');
				text.push(userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._]);
				keyboard = generateKeyboard([MENU.SPECIALS.BACK], 1);
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._:
				text.push(
					'Interval Monate bearbeiten - original:' +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._],
				);
				keyboard = generateNumberedChoiseKeyboard(1, 48, 1, '', '', 6, [MENU.SPECIALS.BACK]);
				break;
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._:
				text.push(
					'Interval Betriebsstunden bearbeiten - original:' +
						userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._],
				);
				keyboard = generateNumberedChoiseKeyboard(1, 48, 1, '', '', 6, [MENU.SPECIALS.BACK]);
				break;
			//#endregion
			//#endregion
			default:
				text.push('sendMenuToUser: menu: "' + JSON.stringify(menu) + '" is not defined');
				keyboard = generateKeyboard([MENU.SPECIALS.BACK, MENU.SPECIALS.ABORT, MENU._text]);
				this.log.error(String(text));
		}
		this.sendKeyboardToUser(user, text, keyboard);
	}

	//-------------------------------------

	async validateUserInput(user, keyboard, command, userCache) {
		this.log.debug('validateUserInput: ' + keyboard + '---' + command);
		if (!this.sql) {
			return;
		}
		switch (keyboard) {
			case MENU.FIREWOOD.NEW.NUMBER:
			case MENU.FIREWOOD.EDIT.NUMBER.CHANGE: {
				if (isInt(command)) {
					const usedNumbers = await this.sql.get(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
					if (!usedNumbers.includes(command)) {
						return command;
					}
				}
				return '!Ungültige Nummer: "' + command + '" - Wird die Nummer bereits verwendet?';
			}
			case MENU.FIREWOOD.EDIT.NUMBER._: {
				if (isInt(command)) {
					const usedNumbers = await this.sql.get(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
					if (usedNumbers.includes(command)) {
						return command;
					}
				}
				return '!Ungültige Nummer: "' + command + '" - Existiert die Nummer?';
			}
			case MENU.FIREWOOD.NEW.AMOUNT: //Number
			case MENU.FIREWOOD.EDIT.AMOUNT:
			case MENU.FIREWOOD.NEW.HUMIDITY:
			case MENU.FIREWOOD.EDIT.HUMIDITY._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._:
				if (!isInt(parseInt(command))) {
					return '!Ungültige Nummer: "' + command + '" - Es wird eine Zahl erwartet';
				}
				return String(parseInt(command));

			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED: //Float
			case MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._:
			case MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._:
				if (!isFloat(parseFloat(command))) {
					return '!Ungültige Nummer: "' + command + '" - Es wird eine Gleitkommazahl erwartet';
				}
				return String(parseFloat(command));

			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._: //bool (0 / 1)
				if (userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._] == 0) {
					return 1;
				} else return 0;

			case MENU.FIREWOOD.NEW.TYPE:
			case MENU.FIREWOOD.EDIT.TYPE._: {
				const validTypes = await this.sql.get(user, MYSQL.GET.FIREWOOD.VALID_TYPES);

				if (validTypes.includes(command)) {
					return command;
				}
				return '!Ungültiger Typ: "' + command + '" - Bitte eine vorgeschlagenen Typ verwenden';
			}
			case MENU.FIREWOOD.NEW.DATE:
			case MENU.FIREWOOD.EDIT.DATE:
				return command; //Is Date function implementieren!!!
			case MENU.FIREWOOD.NEW.LOCATION:
			case MENU.FIREWOOD.EDIT.LOCATION._: {
				const validLocations = await this.sql.get(user, MYSQL.GET.FIREWOOD.VALID_LOCATIONS);
				if (validLocations.includes(command)) {
					return command;
				}
				return '!Ungültiger Typ: "' + command + '" - Bitte eine vorgeschlagenen Typ verwenden';
			}
			case MENU.DIALOG.FILE.ADD_FILE.NAME._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._:
			case MENU.FIREWOOD.NEW.NOTES:
			case MENU.FIREWOOD.EDIT.NOTES._:
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.NOTE._:
				if (command == MENU.SPECIALS.SKIP) {
					return '-';
				} else if (command == MENU.SPECIALS.SAVE) {
					return '-';
				}
				return command;

			case MENU.FIREWOOD.EDIT._:
			case MENU.MACHINES_CATEGORY.MACHINE.HISTORY._:
				return command;

			case MENU.MACHINES_CATEGORY._: {
				const validCategory = await this.sql.get(user, MYSQL.GET.MACHINES.CATEGORY);
				if (validCategory.includes(command)) {
					return command;
				}
				return '!Ungültige Kategorie: "' + command + '" - Bitte eine vorgeschlagene Kategorie verwenden';
			}
			case MENU.MACHINES_CATEGORY.MACHINE._: {
				const validMachine = await this.sql.get(user, MYSQL.GET.MACHINES.MACHINES, userCache);
				if (validMachine.includes(command)) {
					return command;
				}
				return '!Ungültige Maschine: "' + command + '" - Bitte eine vorgeschlagene Maschine verwenden';
			}
			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._: {
				const returnCommand = command.substring(command.search('>') + 1).trimStart();
				const validMaintenance = await this.sql.get(
					user,
					MYSQL.GET.MACHINES.MAINTENANCE.MAINTENANCE,
					userCache,
				);
				if (validMaintenance.includes(command)) {
					return returnCommand;
				}
				return '!Ungültige Wartung: "' + returnCommand + '" - Bitte eine vorgeschlagene Wartung verwenden';
			}

			case MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._: {
				const pathFile =
					this.config.database.filepath +
					FOLDER.MACHINES.MAINTENANCE +
					userCache[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] +
					'/' +
					command;
				if (fs.existsSync(pathFile)) {
					return pathFile;
				}
				return '!Datei existiert nicht: "' + pathFile + '"';
			}

			case MENU.DIALOG.FILE.ADD_FILE._: {
				if (fs.existsSync(command)) {
					return command;
				}
				return '!Datei konnte nicht empfangen werden - Datei existiert nicht: "' + command + '"';
			}
			case MENU.DIALOG.FILE._: {
				const files = await this.getFiles(user, userCache[MENU.DIALOG.FILE.FILE_PATH]);
				for (const count in files) {
					if (files[count] == command) {
						return command;
					}
				}
				if (command == MENU.SPECIALS.ABORT || command == MENU.SPECIALS.BACK) {
					return command;
				}
				return '!Ungültige Datei: "' + command + '" ausgewählt - Bitte eine vorgeschlagene Datei auswählen';
			}

			default:
				return (
					'!validateUserInput: Keyboard "' +
					keyboard +
					'" is not defined\r\n\r\nEnter "' +
					MENU._escape +
					'" to go to the main menu'
				);
		}
	}
	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');v

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }
	async sendTextToUser(user, text) {
		let displayText = '';
		if (!user) {
			this.log.warn('sendTextToUser: No user defined; text: "' + text + '"');
		}

		if (Array.isArray(text)) {
			for (let i = 0; i < text.length; i++) {
				displayText += text[i] + '\n';
			}
		} else {
			displayText = text;
		}

		this.sendTo(
			TELEGRAM_NODE + this.config.telegram.instance,
			'send',
			{
				text: displayText,
				user: user,
				parse_mode: 'html',
			},
			(instance, message) => {
				if (message) {
					this.log.error('sendTextToUser:' + instance + message);
				}
			},
		);
	}

	async sendKeyboardToUser(user, text, keyboard) {
		if (!user) {
			this.log.warn('sendKeyboardToUser: No user defined; text: "' + text + '"');
		}

		let displayText = '';
		if (Array.isArray(text)) {
			for (let i = 0; i < text.length; i++) {
				displayText += text[i] + '\n';
			}
			text = displayText; //To avoid using the unformatted "text" variable
		}

		this.sendTo(
			TELEGRAM_NODE + this.config.telegram.instance,
			{
				text: text || 'undefined',
				user: user,
				reply_markup: {
					parse_mode: 'html',
					keyboard: keyboard,
					resize_keyboard: true,
					one_time_keyboard: false,
				},
			},
			(msg, udf) => {
				msg = msg[0] ? msg : '{"error": "No Result"}';
				msg = JSON.parse(String(msg));
				if (msg.error) {
					this.log.error('Send KeyboardToUser: error:' + JSON.stringify(msg.error));
					this.log.error('Text: "' + text + '"');
					this.log.error('Keyboard: "' + JSON.stringify(keyboard) + '"');
					this.log.error('User: "' + user + '"');
				}
				msg = udf; //Just to ignore the value not used error
			},
		);
	}

	async sendFileToUser(user, filePath) {
		if (!filePath.startsWith(this.config.database.filepath)) {
			filePath = this.config.database.filepath + filePath + '/';
		}
		if (!user) {
			this.log.warn('sendFileToUser: No user defined; filePath: "' + filePath + '"');
			return;
		}
		if (!fs.existsSync(filePath)) {
			this.sendTextToUser(user, 'sendFileToUser: Verzeichnis existiert nicht: "' + filePath + '"');
			return;
		}
		//const items = await fs.readdirSync(filePath);
		//for (const item of items) {
		this.sendTo(TELEGRAM_NODE + this.config.telegram.instance, 'send', {
			text: filePath,
			caption: 'Snapshot',
			user: user,
		});
		//}
	}

	async updateFileSystem(user) {
		if (!user) {
			this.log.warn('updateFileSystem: No user defined;');
		}
		if (!this.sql) {
			this.sendTextToUser(user, 'updateFileSystem: No sql connection possible - return');
			return false;
		}
		const maintenanceIds = await this.sql.get('noUser', MYSQL.GET.MACHINES.MAINTENANCE.ALL_IDS);
		for (const id of maintenanceIds) {
			try {
				fs.mkdirSync(this.config.database.filepath + FOLDER.MACHINES.MAINTENANCE + id, { recursive: true });
			} catch (err) {
				continue;
			}
		}
		return true;
	}

	async moveFile(user, sourcePath, destinationPath, destinationFileName) {
		if (!fs.existsSync(sourcePath)) {
			this.sendTextToUser(user, 'copyFiles: sourcePath - Verzeichnis existiert nicht: "' + sourcePath + '"');
			return false;
		}
		if (!fs.existsSync(destinationPath)) {
			this.sendTextToUser(
				user,
				'copyFiles: destinationPath - Verzeichnis existiert nicht: "' + destinationPath + '"',
			);
			return false;
		}
		if (!destinationPath.startsWith(this.config.database.filepath)) {
			destinationPath = this.config.database.filepath + destinationPath + '/';
		}
		try {
			fs.copyFileSync(sourcePath, destinationPath + destinationFileName);
			fs.rmSync(sourcePath);
			this.log.debug('file removed: ' + sourcePath);
		} catch (err) {
			this.sendTextToUser(user, 'copyFiles: Fehler beim Kopieren: ' + String(err));
		}
	}

	async getFiles(user, filePath) {
		if (!filePath.startsWith(this.config.database.filepath)) {
			filePath = this.config.database.filepath + filePath + '/';
		}
		if (!user) {
			this.log.warn('getFiles: No user defined; filePath: "' + filePath + '"');
			return;
		}
		const result = [];
		if (!fs.existsSync(filePath)) {
			//this.sendTextToUser(user, 'getFiles: Verzeichnis existiert nicht: "' + filePath + '"');
			return result;
		}
		const items = await fs.readdirSync(filePath);
		for (const item of items) {
			result.push(item);
		}
		return result;
	}

	async getFileCount(user, filePath) {
		const files = await this.getFiles(user, filePath);
		return Object.keys(files ? files : '').length;
	}
}

function createDateMod(yearMod, monthMod, dayMod) {
	const date = new Date(Date.now());
	date.setDate(date.getDate() + dayMod);
	date.setMonth(date.getMonth() + monthMod);
	date.setFullYear(date.getFullYear() + yearMod);

	return (
		date.getUTCFullYear() +
		'-' +
		(date.getUTCMonth() + 1) + // months from 1-12
		'-' +
		date.getUTCDate() +
		' ' +
		date.getUTCHours() +
		':' +
		date.getUTCMinutes() +
		':' +
		date.getUTCSeconds()
	);
}

function textToDate(text) {
	let newDate;
	switch (text) {
		case 'heute':
			newDate = createDateMod(0, 0, 0);
			break;
		case 'gestern':
			newDate = createDateMod(0, 0, -1);
			break;
		case 'letzteWoche':
			newDate = createDateMod(0, 0, -7);
			break;
		case 'vorletzteWoche':
			newDate = createDateMod(0, 0, -14);
			break;
		case 'letztenMonat':
			newDate = createDateMod(0, -1, 0);
			break;
		case 'letztesJahr':
			newDate = createDateMod(-1, 0, 0);
			break;
	}
	return newDate;
}
function isInt(value) {
	return !isNaN(value) && parseInt(value) == value && !isNaN(parseInt(value, 10));
}
function isFloat(value) {
	return !isNaN(value) && parseFloat(value) == value && !isNaN(parseFloat(value));
}
function generateKeyboard(arrValues, columns, menu) {
	const arrKeyboard = new Array();
	let arrTemp = [];
	let valuesCount = 0;
	const arrValuesLength = arrValues ? arrValues.length : 0;
	console.error('arrValuesLength' + arrValuesLength);
	if (!columns) {
		columns = 1;
	}
	for (let rowCount = 0; rowCount < arrValuesLength / columns; rowCount++) {
		arrTemp = [];
		for (let columnCount = 0; columnCount < columns; columnCount++) {
			if (arrValues.length > valuesCount) {
				arrTemp[columnCount] = String(arrValues[valuesCount]);
				valuesCount++;
			}
		}
		arrKeyboard.push(arrTemp);
	}
	if (menu) {
		if (Array.isArray(menu)) {
			//A Menu has always one column
			for (const count in menu) {
				arrKeyboard.push([menu[count]]);
			}
		} else {
			arrKeyboard.push([menu]);
		}
	}
	return arrKeyboard;
}
function generateNumberedChoiseKeyboard(start, end, step, pre, post, columns, menu) {
	const arrValues = [];
	for (let i = start; i <= end; i = i + step) {
		arrValues.push(pre + i + post);
	}
	return generateKeyboard(arrValues, columns, menu);
}
function datasetToUserCash(userCache, dataset) {
	if (!userCache) {
		userCache = JSON.parse('{"emty": "true"}');
	}
	userCache = Object.assign(userCache, dataset); // add userCash to existing dataset

	return userCache;
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new SqlTelegramFarm(options);
} else {
	// otherwise start the instance directly
	new SqlTelegramFarm();
}
