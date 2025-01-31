'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const mysql = require('mysql2/promise');
//const menu = require('./lib/menu.json');

//var xml = new XML(menu);

// Load your modules here, e.g.:
// const fs = require("fs");

const TELEGRAM_NODE = 'telegram.';
let telegramInstanceNode = 'telegram.0.';

let mySqlCon;

//let tgInstancePath = 'telegram.0.'; //tg = Telegram
//let nodeTgConnection = 'telegram.0.info.connection';

const MENU = {
	_: 'menu',
	_text: 'Hauptmenü',
	_escape: '/',
	FIREWOOD: {
		_: 'firewood',
		_text: 'Brennholz',
		NEW: {
			_: 'firewood.new',
			_text: 'Neues Brennholz',
			NUMBER: 'firewood.new.number',
			AMOUNT: 'firewood.new.amount',
			AMOUNT_DETAILED: 'firewood.new.amountDetailed',
			TYPE: 'firewood.new.type',
			HUMIDITY: 'firewood.new.humidity',
			DATE: 'firewood.new.date',
			LOCATION: 'firewood.new.location',
			NOTES: 'firewood.new.notes',
			REVIEW: 'firewood.new.review',
			SAVE: 'firewood.new.save',
		},
		EDIT: {
			_: 'firewood.edit',
			_text: 'Brennholz bearbeiten',
			ID: { _: 'firewood.edit.id', _text: 'Id :  ' },

			NUMBER: {
				_: 'firewood.edit.number',
				_text: 'Nr. : ',
				CHANGE: 'firewood.edit.number.change',
			},
			AMOUNT: 'firewood.edit.amount',
			AMOUNT_DETAILED: {
				_: 'firewood.edit.amountDetailed',
				_text: 'Menge : ',
			},
			TYPE: {
				_: 'firewood.edit.type',
				_text: 'Art : ',
			},
			HUMIDITY: {
				_: 'firewood.edit.humidity',
				_text: 'Feuchte : ',
			},
			DATE: 'firewood.edit.date', //Not programmed yet
			LOCATION: {
				_: 'firewood.edit.location',
				_text: 'Lagerort : ',
			},
			NOTES: {
				_: 'firewood.edit.notes',
				_text: 'Notiz : ',
			},
			DELETE: {
				_: 'firewood.edit.delete',
				_text: 'auflösen',
			},
		},
		STATUS: {
			_: 'firewood.status',
			_text: 'Brennholz Status',
		},
	},
	MACHINES: {
		_: 'machines',
		_text: 'Maschinen',
	},
	SPECIALS: {
		ABORT: 'Abbruch',
		BACK: 'Zurück',
		SAVE: 'Speichern',
		SKIP: 'überspringen',
	},
};

const MYSQL = {
	GET: {
		FIREWOOD: {
			USED_NUMBERS: 'get.firewood.usedNumbers',
			VALID_TYPES: 'get.firewood.validTypes',
			VALID_LOCATIONS: 'get.firewood.validLocations',
			STATUS: 'get.firewood.status',
			DATASET_BY_NUMBER: 'get.firewood.dataset-by-number',
		},
	},
	SET: {
		FIREWOOD: {
			SAVE_NEW: 'set.firewood.saveNew',
			SAVE_EDIT: 'set.firewood.saveEdit',
		},
	},
};

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
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 *
	 */
	async onReady() {
		// Initialize your adapter here

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
		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates('testVariable');

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

		/*this.mySqlCon.config.host = this.config.database.server;
		this.mySqlCon.config.user = this.config.database.user;
		this.mySqlCon.config.password = this.config.database.password;
		this.mySqlCon.config.database = this.config.database.database;
*/

		await this.mySqlEnsureConnection();

		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		// examples for the checkPassword/checkGroup functions
		//	let result = await this.checkPasswordAsync('admin', 'iobroker');
		//	this.log.info('check user admin pw iobroker: ' + result);

		//	result = await this.checkGroupAsync('admin', 'admin');
		//	this.log.info('check group user admin group admin: ' + result);

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
		const userMenuState = await this.getStateAsync('users.' + user + '.menu');
		let userMenu = userMenuState ? String(userMenuState.val) : MENU._;
		let newUserMenu = '';
		const emtyUserCache = JSON.parse('{"emty": "true"}');
		const userCacheState = await this.getStateAsync('users.' + user + '.cache');
		let userCache = emtyUserCache;
		try {
			userCache = userCacheState ? JSON.parse(String(userCacheState.val)) : emtyUserCache;
		} catch (err) {
			this.log.error('prepareRequest: UserCache could not read user Cache ' + err);
		}

		this.log.debug('userMenu: "' + userMenu + '" - userCache: "' + JSON.stringify(userCache) + '"');

		const validateInput = await this.validateUserInput(user, userMenu, command); //true, if the input e.g. number is in the correct format. MENU.SPECIAL is handled below.
		let validInput = false;
		if (validateInput.substring(0, 1) != '!') {
			validInput = true;
			command = validateInput;
		}

		if (command == MENU._text || command == MENU._escape) {
			//If Main Menu is called: Always go to main menu; It doesn't matter in which menu you are at the moment
			userMenu = MENU._;
			userCache = emtyUserCache;
		}
		switch (userMenu) {
			case MENU._:
				if (command == MENU.FIREWOOD._text) {
					newUserMenu = MENU.FIREWOOD._;
					this.sendMenuToUser(user, MENU.FIREWOOD._);
				} else if (command == MENU.MACHINES._text) {
					newUserMenu = MENU.MACHINES._;
					this.sendMenuToUser(user, MENU.MACHINES._);
				} else {
					newUserMenu = MENU._;
					this.sendMenuToUser(user, MENU._);
				}
				break;
			// #region FIREWOOD
			case MENU.FIREWOOD._:
				if (command == MENU.FIREWOOD.NEW._text) {
					userCache = emtyUserCache;
					newUserMenu = MENU.FIREWOOD.NEW.NUMBER;
					await this.sendMenuToUser(user, MENU.FIREWOOD.NEW.NUMBER);
				} else if (command == MENU.FIREWOOD.EDIT._text) {
					newUserMenu = MENU.FIREWOOD.EDIT.NUMBER._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.NUMBER._);
				} else if (command == MENU.FIREWOOD.STATUS._text) {
					newUserMenu = MENU.FIREWOOD._;
					this.sendTextToUser(user, await this.getMySql(user, MYSQL.GET.FIREWOOD.STATUS));
				} else {
					newUserMenu = MENU._;
					this.sendMenuToUser(user, MENU._);
				}
				break;
			// #region FIREWOOD.New
			case MENU.FIREWOOD.NEW.NUMBER: //Sequence - 1 - Number
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.FIREWOOD._;
					this.sendMenuToUser(user, MENU.FIREWOOD._);
					userCache = emtyUserCache;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.NUMBER] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.AMOUNT);
				}
				break;
			case MENU.FIREWOOD.NEW.AMOUNT: //Sequence - 2 - Amount
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.NUMBER;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.NUMBER);
					userCache = emtyUserCache;
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.AMOUNT] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT_DETAILED;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.AMOUNT_DETAILED, userCache[MENU.FIREWOOD.NEW.AMOUNT]);
				}
				break;
			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED: //Sequence - 3 - Amount Detailed
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.AMOUNT);
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.AMOUNT_DETAILED] = parseFloat(command);
					newUserMenu = MENU.FIREWOOD.NEW.TYPE;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.TYPE);
				}
				break;
			case MENU.FIREWOOD.NEW.TYPE: //Sequence - 4 - Type
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT_DETAILED;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.AMOUNT_DETAILED);
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.TYPE] = command;
					newUserMenu = MENU.FIREWOOD.NEW.HUMIDITY;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.HUMIDITY);
				}
				break;
			case MENU.FIREWOOD.NEW.HUMIDITY: //Sequence - 5 - Humidity
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.TYPE;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.TYPE);
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.HUMIDITY] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.DATE;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.DATE);
				}
				break;
			case MENU.FIREWOOD.NEW.DATE: //Sequence - 6 - Date
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.HUMIDITY;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.HUMIDITY);
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.DATE] = textToDate(command);
					newUserMenu = MENU.FIREWOOD.NEW.LOCATION;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.LOCATION);
				}
				break;
			case MENU.FIREWOOD.NEW.LOCATION: //Sequence - 7 - Location
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.DATE;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.DATE);
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.LOCATION] = command;
					newUserMenu = MENU.FIREWOOD.NEW.NOTES;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.NOTES);
				}
				break;
			case MENU.FIREWOOD.NEW.NOTES: //Sequence - 8 - Notes
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.LOCATION;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.LOCATION);
				} else if (validInput) {
					userCache[MENU.FIREWOOD.NEW.NOTES] = command;
					newUserMenu = MENU.FIREWOOD.NEW.REVIEW;
					const text = [];
					text[0] = 'Zusammenfassung';
					text[1] = 'Nr.           : ' + userCache[MENU.FIREWOOD.NEW.NUMBER];
					text[2] = 'Menge    : ' + userCache[MENU.FIREWOOD.NEW.AMOUNT_DETAILED] + '[Ster]';
					text[3] = 'Art           : ' + userCache[MENU.FIREWOOD.NEW.TYPE];
					text[4] = 'Feuchte  : ' + userCache[MENU.FIREWOOD.NEW.HUMIDITY] + '%';
					text[5] = 'Lagerort : ' + userCache[MENU.FIREWOOD.NEW.LOCATION];
					text[6] = 'Erstellt    : ' + userCache[MENU.FIREWOOD.NEW.DATE];
					text[7] = 'Notiz       : ' + userCache[MENU.FIREWOOD.NEW.NOTES];
					this.sendKeyboardToUser(user, text, [
						[MENU.SPECIALS.SAVE],
						[MENU.SPECIALS.BACK],
						[MENU.SPECIALS.ABORT],
					]);
				}
				break;
			case MENU.FIREWOOD.NEW.REVIEW: //Sequence - 9 - Review
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.NOTES;
					this.sendMenuToUser(user, MENU.FIREWOOD.NEW.NOTES);
				} else if (command == MENU.SPECIALS.ABORT) {
					userCache = emtyUserCache;
					newUserMenu = MENU.FIREWOOD._;
					this.sendMenuToUser(user, MENU.FIREWOOD._);
				} else if (command == MENU.SPECIALS.SAVE) {
					if (await this.setMySql(user, MYSQL.SET.FIREWOOD.SAVE_NEW, userCache)) {
						this.sendTextToUser(user, 'Neuer Eintrag wurde erfolgreich gespeichert');
						this.sendMenuToUser(user, MENU.FIREWOOD._);
						userCache = emtyUserCache;
						newUserMenu = MENU.FIREWOOD._;
					} else {
						newUserMenu = MENU.FIREWOOD.NEW.REVIEW;
					}
				}

				break;
			// #endregion
			// #region Firewood - Edit
			case MENU.FIREWOOD.EDIT.NUMBER._:
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.FIREWOOD._;
					this.sendMenuToUser(user, MENU.FIREWOOD._);
					userCache = emtyUserCache;
				} else if (validInput) {
					userCache = await this.getMySql(user, MYSQL.GET.FIREWOOD.DATASET_BY_NUMBER, command);
					newUserMenu = MENU.FIREWOOD.EDIT._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT._, userCache);
				}
				break;
			case MENU.FIREWOOD.EDIT._: {
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.FIREWOOD._;
					this.sendMenuToUser(user, MENU.FIREWOOD._);
					userCache = emtyUserCache;
				} else if (command == MENU.SPECIALS.SAVE) {
					if (await this.setMySql(user, MYSQL.SET.FIREWOOD.SAVE_EDIT, userCache)) {
						this.sendTextToUser(user, 'Eintrag wurde erfolgreich geändert');
						this.sendMenuToUser(user, MENU.FIREWOOD._);
						userCache = emtyUserCache;
						newUserMenu = MENU.FIREWOOD._;
					} else {
						newUserMenu = MENU.FIREWOOD.EDIT._;
					}
					this.sendMenuToUser(user, MENU.FIREWOOD._);
					userCache = emtyUserCache;
				} else if (command.includes(MENU.FIREWOOD.EDIT.ID._text)) {
					newUserMenu = userMenu;
					this.sendTextToUser(user, 'Die Id kann nicht bearbeitet werden');
				} else if (command.includes(MENU.FIREWOOD.EDIT.NUMBER._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.NUMBER.CHANGE;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.NUMBER.CHANGE);
				} else if (command.includes(MENU.FIREWOOD.EDIT.TYPE._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.TYPE._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.TYPE._);
				} else if (command.includes(MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.AMOUNT;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.AMOUNT);
				} else if (command.includes(MENU.FIREWOOD.EDIT.HUMIDITY._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.HUMIDITY._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.HUMIDITY._);
				} else if (command.includes(MENU.FIREWOOD.EDIT.LOCATION._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.LOCATION._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.LOCATION._);
				} else if (command.includes(MENU.FIREWOOD.EDIT.NOTES._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.NOTES._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.NOTES._);
				} else if (command.includes(MENU.FIREWOOD.EDIT.DELETE._text)) {
					newUserMenu = MENU.FIREWOOD.EDIT.DELETE._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT.DELETE._);
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
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT._, userCache);
				} else if (validInput) {
					userCache[userMenu] = command;
					newUserMenu = MENU.FIREWOOD.EDIT._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT._, userCache);
				}
				break;
			case MENU.FIREWOOD.EDIT.AMOUNT: //Sequence - 2 - Amount
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.EDIT._;
					this.sendMenuToUser(user, MENU.FIREWOOD.EDIT._);
				} else if (validInput) {
					userCache[MENU.FIREWOOD.EDIT.AMOUNT] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._;
					this.sendMenuToUser(
						user,
						MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._,
						userCache[MENU.FIREWOOD.EDIT.AMOUNT],
					);
				}
				break;

			// #endregion
			// #endregion
			default:
				if (command == MENU._text) {
					newUserMenu = MENU._;
					this.sendMenuToUser(user, MENU._);
				}
				break;
		}
		if (newUserMenu == '') {
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
				await this.sendMenuToUser(user, MENU._);
			}
		}
		await this.setState('users.' + user + '.menu', { val: newUserMenu, ack: true });
		//console.warn(userCache);
		//console.warn(JSON.stringify(userCache));
		console.log(userCache);
		await this.setState('users.' + user + '.cache', { val: JSON.stringify(userCache), ack: true });
	}

	async sendMenuToUser(user, menu, parameters) {
		let keyboard = [];
		let text = ' ';
		switch (menu) {
			case MENU._:
				text = MENU._text;
				keyboard.push([MENU.FIREWOOD._text]);
				keyboard.push([MENU.MACHINES._text]);
				break;
			case MENU.FIREWOOD._:
				text = MENU.FIREWOOD._text;
				keyboard.push([MENU._text]);
				keyboard.push([MENU.FIREWOOD.STATUS._text]);
				keyboard.push([MENU.FIREWOOD.NEW._text]);
				keyboard.push([MENU.FIREWOOD.EDIT._text]);
				break;
			case MENU.FIREWOOD.NEW.NUMBER:
			case MENU.FIREWOOD.EDIT.NUMBER.CHANGE: {
				const result = await this.getMySql(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
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
				text = 'Welche Nummer wurde angebraucht?';
				keyboard = generateKeyboard(arrAnswers, 3, MENU.SPECIALS.ABORT);
				break;
			}
			case MENU.FIREWOOD.EDIT.NUMBER._: {
				const result = await this.getMySql(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
				text = 'Welche Nummer wurde angebraucht?';
				keyboard = generateKeyboard(result, 3, MENU.SPECIALS.ABORT);
				break;
			}
			case MENU.FIREWOOD.EDIT._: {
				text = 'Holz Nr. ' + parameters[MENU.FIREWOOD.EDIT.NUMBER._] + ' bearbeiten';
				keyboard.push([
					MENU.FIREWOOD.EDIT.ID._text + parameters[MENU.FIREWOOD.EDIT.ID._],
					MENU.FIREWOOD.EDIT.NUMBER._text + parameters[MENU.FIREWOOD.EDIT.NUMBER.CHANGE],
					MENU.FIREWOOD.EDIT.TYPE._text + parameters[MENU.FIREWOOD.EDIT.TYPE._],
				]);
				keyboard.push([
					MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._text +
						parameters[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._] +
						'[Ster]',
				]);
				keyboard.push([MENU.FIREWOOD.EDIT.HUMIDITY._text + parameters[MENU.FIREWOOD.EDIT.HUMIDITY._] + '%']);
				keyboard.push([MENU.FIREWOOD.EDIT.LOCATION._text + parameters[MENU.FIREWOOD.EDIT.LOCATION._]]);
				keyboard.push([MENU.FIREWOOD.EDIT.NOTES._text + parameters[MENU.FIREWOOD.EDIT.NOTES._]]);
				keyboard.push(['auflösen']);
				keyboard.push([MENU.SPECIALS.SAVE, MENU.SPECIALS.ABORT]);
				break;
			}
			case MENU.FIREWOOD.NEW.AMOUNT:
			case MENU.FIREWOOD.EDIT.AMOUNT:
				text = 'Menge in Ster';
				keyboard = generateNumberedChoiseKeyboard(0, 20, 1, '', '', 3, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED:
			case MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._:
				text = 'Detaillierte Menge in Ster';
				keyboard = generateNumberedChoiseKeyboard(0, 75, 25, parameters + '.', '', 2, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.TYPE:
			case MENU.FIREWOOD.EDIT.TYPE._:
				text = 'Holzart';
				keyboard = generateKeyboard(
					await this.getMySql(user, MYSQL.GET.FIREWOOD.VALID_TYPES),
					2,
					MENU.SPECIALS.BACK,
				);
				break;
			case MENU.FIREWOOD.NEW.HUMIDITY:
			case MENU.FIREWOOD.EDIT.HUMIDITY._:
				text = 'Feuchtigkeit in %';
				keyboard = generateNumberedChoiseKeyboard(5, 30, 1, '', '%', 5, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.DATE:
				text = 'Anlage / Änderungsdatum';
				keyboard = generateKeyboard(
					['heute', 'gestern', 'letzteWoche', 'vorletzteWoche', 'letztenMonat', MENU.SPECIALS.BACK],
					1,
				);
				break;
			case MENU.FIREWOOD.NEW.LOCATION:
			case MENU.FIREWOOD.EDIT.LOCATION._:
				text = 'Lagerort';
				keyboard = generateKeyboard(
					await this.getMySql(user, MYSQL.GET.FIREWOOD.VALID_LOCATIONS),
					2,
					MENU.SPECIALS.BACK,
				);
				break;
			case MENU.FIREWOOD.NEW.NOTES:
			case MENU.FIREWOOD.EDIT.NOTES._:
				text = 'Notizen (optional)';
				keyboard = generateKeyboard([MENU.SPECIALS.SKIP, MENU.SPECIALS.BACK], 1);
				break;

			default:
				text = 'sendMenuToUser: menu: "' + JSON.stringify(menu) + '" is not defined';
				keyboard = generateKeyboard([MENU.SPECIALS.BACK, MENU.SPECIALS.ABORT, MENU._text], 1);
				this.log.error(text);
		}
		this.sendKeyboardToUser(user, text, keyboard);
	}

	async sendKeyboardToUser(user, text, keyboard) {
		if (!user) {
			this.log.warn('sendTextToUser: No user defined; text: "' + text + '"');
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

	//----------------------------------------------------------------
	/*	async mySqlError(err, user) {
		this.sendTextToUser(
			'Datenbankfehler: Eingabe wurde nicht übernommen\r\n' + 'Hinweis:\r\n' + err + '\r\n',
			user,
		);
		if (err == "Can't add new command when connection is in closed state") {
			this.mySqlCon = mysql.createConnection(this.mySqlCon.config);
			this.mySqlCon.connect((err) => {
				if (err) {
					this.sendTextToUser('Datenbankfehler: Verbindung zum SQL Server kann nicht aufgebaut werden');
					return;
				}
				this.sendTextToUser('Datenbank wurde neu verbunden, bitte erneut versuchen');
			});
			await this.sendTextToUser('');
		}
	}*/
	async sendTextToUser(user, text) {
		let displayText = '';
		if (!user) {
			this.log.warn('sendTextToUser: No user defined; text: "' + text + '"');
		}
		console.log(text);

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
	//-------------------------------------

	async setMySql(user, sqlFunction, parameters) {
		try {
			await this.mySqlEnsureConnection();

			switch (sqlFunction) {
				case MYSQL.SET.FIREWOOD.SAVE_NEW: {
					//Create the new entry
					const [maxId] = await mySqlCon.query('SELECT MAX(id) As id FROM wood');
					const sql =
						'INSERT INTO wood (id, activ, nr, amount, typ, dateMod, humidity, notes, location, user) ';
					const arrValues = [
						String(maxId[0].id + 1),
						'2',
						String(parameters[MENU.FIREWOOD.NEW.NUMBER]),
						String(parameters[MENU.FIREWOOD.NEW.AMOUNT_DETAILED]),
						String(parameters[MENU.FIREWOOD.NEW.TYPE]),
						String(parameters[MENU.FIREWOOD.NEW.DATE]),
						String(parameters[MENU.FIREWOOD.NEW.HUMIDITY]),
						String(parameters[MENU.FIREWOOD.NEW.NOTES]),
						String(parameters[MENU.FIREWOOD.NEW.LOCATION]),
						String(user),
					];
					const values = generateSqlValues(arrValues);
					const [result] = await mySqlCon.query(sql + values);
					if (result.warningStatus == '') {
						return true;
					}
					return false;
				}
				case MYSQL.SET.FIREWOOD.SAVE_EDIT: {
					//Set the last entry to "History"
					const sql =
						'UPDATE wood SET activ="1" WHERE activ="2" AND id="' +
						parameters[MENU.FIREWOOD.EDIT.ID._] +
						'"';
					const [saveResult] = await mySqlCon.query(sql);
					if (saveResult.warningStatus == '') {
						//Insert the new row
						const [maxId] = await mySqlCon.query('SELECT MAX(id) As id FROM wood');
						const sql =
							'INSERT INTO wood (id, activ, nr, amount, typ, dateMod, humidity, notes, location, user) ';
						const arrValues = [
							String(maxId[0].id + 1),
							'2',
							String(parameters[MENU.FIREWOOD.EDIT.NUMBER._]),
							String(parameters[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._]),
							String(parameters[MENU.FIREWOOD.EDIT.TYPE._]),
							String(parameters[MENU.FIREWOOD.EDIT.DATE]),
							String(parameters[MENU.FIREWOOD.EDIT.HUMIDITY._]),
							String(parameters[MENU.FIREWOOD.EDIT.NOTES._]),
							String(parameters[MENU.FIREWOOD.EDIT.LOCATION._]),
							String(user),
						];
						const values = generateSqlValues(arrValues);
						const [result] = await mySqlCon.query(sql + values);
						if (result.warningStatus == '') {
							return true;
						}
						return false;
					}
					return false;

					/*
					const sql =
						'UPDATE wood SET nr ="' +
						String(parameters[MENU.FIREWOOD.EDIT.NUMBER.CHANGE]) +
						'", amount= "' +
						String(parameters[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._]) +
						'", typ="' +
						String(parameters[MENU.FIREWOOD.EDIT.TYPE._]) +
						'", humidity= "' +
						String(parameters[MENU.FIREWOOD.EDIT.HUMIDITY._]) +
						'", notes="' +
						String(parameters[MENU.FIREWOOD.EDIT.NOTES._]) +
						'", location="' +
						String(parameters[MENU.FIREWOOD.EDIT.LOCATION._]) +
						'" WHERE id="' +
						String(parameters[MENU.FIREWOOD.EDIT.ID._]) +
						'"';

					const [result] = await mySqlCon.query(sql);
					if (result.warningStatus == '') {
						return true;
					}
					return false;*/
				}
				default:
					this.sendTextToUser(user, 'setMySql: sqlFunction "' + sqlFunction + '"not available');
					this.sendTextToUser(user, 'Parameters: "' + JSON.stringify(parameters) + '"');
					return false;
			}
		} catch (err) {
			this.log.error(String(err));
			await this.sendTextToUser(user, 'setMySql: "' + sqlFunction + '" - ' + err);
			await this.sendTextToUser(user, 'Parameters: "' + JSON.stringify(parameters) + '"');
		}
		return false;
	}
	async getMySql(user, sqlFunction, parameters) {
		try {
			await this.mySqlEnsureConnection();

			switch (sqlFunction) {
				case MYSQL.GET.FIREWOOD.USED_NUMBERS: {
					const [arrNr] = await mySqlCon.query('SELECT DISTINCT nr FROM wood WHERE activ > 0 ORDER BY nr');
					const result = [];
					for (const count in arrNr) {
						result.push(String(arrNr[count].nr));
					}
					return result;
				}
				case MYSQL.GET.FIREWOOD.VALID_TYPES: {
					const [arrTypes] = await mySqlCon.query('SHOW COLUMNS FROM wood WHERE FIELD = "typ"');
					return mySqlColumnToArray(arrTypes);
				}
				case MYSQL.GET.FIREWOOD.VALID_LOCATIONS: {
					const [arrLocations] = await mySqlCon.query('SHOW COLUMNS FROM wood WHERE FIELD = "location"');
					return mySqlColumnToArray(arrLocations);
				}
				case MYSQL.GET.FIREWOOD.STATUS: {
					//Calculate statistics
					/*	const [result] = await mySqlCon.query(
						'SELECT id, nr, amount, 	(SELECT propertyText FROM wood_datapoints WHERE wood.typ = wood_datapoints.propertyInt) AS typ, humidity, ' +
							'(SELECT dateMod FROM wood w1 WHERE w1.Id = wood.Id ORDER BY dateMod DESC LIMIT 1) AS dateCreation, ' +
							'(SELECT propertyText FROM wood_datapoints WHERE wood.location = wood_datapoints.propertyInt) AS location ' +
							'FROM wood WHERE activ > 1 ORDER BY humidity',
					);*/
					const [result] = await mySqlCon.query(
						'SELECT id, nr, amount, typ, humidity, notes, location FROM wood WHERE activ > 1 ORDER BY humidity',
					);

					const [resultStat] = await mySqlCon.query(
						'SELECT SUM(amount) AS amountTotal, ' +
							'(SELECT SUM(amount) FROM wood WHERE humidity < 18 AND activ > 1) AS amountFinished, ' +
							'Round(AVG(humidity),1) AS humidityAvg ' +
							'FROM wood WHERE activ > 1',
					);

					const text = [];
					text[0] = '<b>Brennholzstatus:</b>    ' + createDateMod(0, 0, 0);
					text[1] = ' ';
					text[2] = '<code>';
					for (let i = 0; i < result.length; i++) {
						if (result[i].humidity < 10) {
							result[i].humidity = ' ' + result[i].humidity;
						}
						if (result[i].nr < 10) {
							result[i].nr = ' ' + result[i].nr;
						}
						text.push(
							result[i].humidity +
								'%   ' +
								result[i].amount +
								'Ster  #' +
								result[i].nr +
								'  ' +
								result[i].location +
								'\r\n ' +
								result[i].typ +
								' ' +
								result[i].notes +
								'\r\n',
						);
					}

					text.push('\n');
					text.push('</code>');
					text.push('#####################');
					text.push('###<b> Zusammenfassung</b>###');
					text.push('#####################');
					text.push('<code>');
					//Enter Statistics
					text.push(
						'Menge gesamt      : </code><span class="tg-spoiler">' +
							resultStat[0].amountTotal +
							'Ster</span><code>',
					);
					text.push(
						'Menge &lt18%        : </code><span class="tg-spoiler">' +
							resultStat[0].amountFinished +
							'Ster</span><code>',
					);
					text.push(
						'Durchschn. Feuchte: </code><span class="tg-spoiler">' +
							resultStat[0].humidityAvg +
							'%</span><code>',
					);
					text.push('</code>');

					return text;
				}
				case MYSQL.GET.FIREWOOD.DATASET_BY_NUMBER: {
					const [arrDATASET] = await mySqlCon.query(
						'SELECT id, nr, activ, amount, typ, DATE_FORMAT(dateMod, "%Y-%m-%d") as dateMod, humidity, notes, location FROM wood WHERE activ = "2" AND nr = "' +
							parameters +
							'"',
					);
					const result = {};
					result[MENU.FIREWOOD.EDIT.ID._] = arrDATASET[0].id;
					result[MENU.FIREWOOD.EDIT.NUMBER._] = arrDATASET[0].nr;
					result[MENU.FIREWOOD.EDIT.NUMBER.CHANGE] = arrDATASET[0].nr;
					result[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._] = arrDATASET[0].amount;
					result[MENU.FIREWOOD.EDIT.TYPE._] = arrDATASET[0].typ;
					result[MENU.FIREWOOD.EDIT.DATE] = arrDATASET[0].dateMod;
					result[MENU.FIREWOOD.EDIT.HUMIDITY._] = arrDATASET[0].humidity;
					result[MENU.FIREWOOD.EDIT.NOTES._] = arrDATASET[0].notes;
					result[MENU.FIREWOOD.EDIT.LOCATION._] = arrDATASET[0].location;
					return result;
				}
				default: {
					const WARNING =
						'getMySql: sqlFunction: "' +
						sqlFunction +
						'" could not be found; User: "' +
						user +
						'", parameters: "' +
						parameters +
						'"';
					this.log.warn(WARNING);
					this.sendTextToUser(user, WARNING);
					break;
				}
			}
		} catch (err) {
			this.log.error(String(err));
			this.sendTextToUser(user, 'getMySql: "' + sqlFunction + '" - ' + err);
			this.sendTextToUser(user, 'Parameters' + JSON.stringify(parameters));
		}
		return ['noResults'];
	}
	async validateUserInput(user, keyboard, command) {
		switch (keyboard) {
			case MENU.FIREWOOD.NEW.NUMBER:
			case MENU.FIREWOOD.EDIT.NUMBER.CHANGE: {
				if (isInt(command)) {
					const usedNumbers = await this.getMySql(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
					if (!usedNumbers.includes(command)) {
						return command;
					}
				}
				return '!Ungültige Nummer: "' + command + '" - Wird die Nummer bereits verwendet?';
			}
			case MENU.FIREWOOD.EDIT.NUMBER._: {
				if (isInt(command)) {
					const usedNumbers = await this.getMySql(user, MYSQL.GET.FIREWOOD.USED_NUMBERS);
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
				if (!isInt(parseInt(command))) {
					return '!Ungültige Nummer: "' + command + '" - Es wird eine Zahl erwartet';
				}
				return String(parseInt(command));

			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED:
			case MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._:
				if (!isFloat(parseFloat(command))) {
					return '!Ungültige Nummer: "' + command + '" - Es wird eine Gleitkommazahl erwartet';
				}
				return String(parseFloat(command));

			case MENU.FIREWOOD.NEW.TYPE:
			case MENU.FIREWOOD.EDIT.TYPE._: {
				const validTypes = await this.getMySql(user, MYSQL.GET.FIREWOOD.VALID_TYPES);

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
				const validLocations = await this.getMySql(user, MYSQL.GET.FIREWOOD.VALID_LOCATIONS);
				if (validLocations.includes(command)) {
					return command;
				}
				return '!Ungültiger Typ: "' + command + '" - Bitte eine vorgeschlagenen Typ verwenden';
			}
			case MENU.FIREWOOD.NEW.NOTES:
			case MENU.FIREWOOD.EDIT.NOTES._:
				if (command == MENU.SPECIALS.SKIP) {
					return '-';
				}
				return command;
			case MENU.FIREWOOD.EDIT._:
				return command;
			default:
				return '!validateUserInput: Keyboard "' + keyboard + '" is not defined';
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
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }
	async mySqlEnsureConnection() {
		try {
			await mySqlCon.query('SELECT 1');
		} catch (error) {
			try {
				//	this.log.warn('mySqlCreateConnection() - State: "' + mySqlCon.state + '"');

				mySqlCon = await mysql.createConnection({
					host: this.config.database.server,
					user: this.config.database.user,
					password: this.config.database.password,
					database: this.config.database.database,
					port: this.config.database.port,
				});
				console.log(mySqlCon);
				this.log.info('SQL Connection created');
			} catch (err) {
				this.log.error(err);
				//	this.sendTextToUser(user, 'mySQLCreateConnection: Verbindung zur Datenbank nicht möglich: "' + err + '"');
			}
		}
	}
}

function generateNumberedChoiseKeyboard(start, end, step, pre, post, columns, menu) {
	const arrValues = [];
	for (let i = start; i <= end; i = i + step) {
		arrValues.push(pre + i + post);
	}
	return generateKeyboard(arrValues, columns, menu);
}
function generateKeyboard(arrValues, columns, menu) {
	const arrKeyboard = new Array();
	let arrTemp = [];
	let valuesCount = 0;
	for (let rowCount = 0; rowCount < arrValues.length / columns; rowCount++) {
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
function generateSqlValues(arrValues) {
	let result = ' VALUES(';
	for (const count in arrValues) {
		result = result + "'" + arrValues[count] + "', ";
	}
	result = result?.substring(0, result.length - 2) + ')';
	return result;
}

function createDateMod(yearMod, monthMod, dayMod) {
	const date = new Date(Date.now());
	date.setDate(date.getDate() + dayMod);
	date.setMonth(date.getMonth() + monthMod);
	date.setFullYear(date.getFullYear() + yearMod);

	const month = date.getUTCMonth() + 1; // months from 1-12
	const day = date.getUTCDate();
	const year = date.getUTCFullYear();

	return year + '-' + month + '-' + day;
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
	}
	return newDate;
}
function isInt(value) {
	return !isNaN(value) && parseInt(value) == value && !isNaN(parseInt(value, 10));
}
function isFloat(value) {
	return !isNaN(value) && parseFloat(value) == value && !isNaN(parseFloat(value));
}

function mySqlColumnToArray(arrResult) {
	let strTypes = '';
	let result = [];
	strTypes = String(arrResult[0].Type);
	strTypes = strTypes.replaceAll('enum(', '');
	strTypes = strTypes.replaceAll("'", '');
	strTypes = strTypes.replaceAll(')', '');
	result = strTypes.split(',');
	return result;
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
