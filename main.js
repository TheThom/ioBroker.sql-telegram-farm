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
	FIREWOOD: {
		_: 'firewood',
		_text: 'Brennholz',
		NEW: {
			_: 'firewood.new',
			_text: 'Neues Brennholz',
			NUMBER: {
				_: 'firewood.new.number',
				_text: 'Welche Nummer wurde angebracht',
			},
			AMOUNT: {
				_: 'firewood.new.amount',
				_text: 'Anzahl in Ster',
			},
			AMOUNT_DETAILED: {
				_: 'firewood.new.amountDetailed',
				_text: 'Detaillierte Anzahl in Ster',
			},
			TYPE: {
				_: 'firewood.new.type',
				_text: 'Holzart',
			},
			HUMIDITY: {
				_: 'firewood.new.humidity',
				_text: 'Feuchtigkeit',
			},
			DATE: {
				_: 'firewood.new.date',
				_text: 'Wann wurde das Holz gemacht?',
			},
			LOCATION: {
				_: 'firewood.new.location',
				_text: 'Lagerort',
			},
			NOTES: {
				_: 'firewood.new.notes',
				_text: 'Notizen',
			},
			REVIEW: {
				_: 'firewood.new.review',
				_text: 'Zusammenfassung',
			},
			SAVE: 'firewood.new.save',
		},
		EDIT: {
			_: 'firewood.edit',
			_text: 'Brennholz bearbeiten',
			NUMBER: 'firewood.edit.number',
			AMOUNT: 'firewood.edit.amount',
			AMOUNT_DETAILED: 'firewood.edit.amountDetailed',
			TYPE: 'firewood.edit.type',
			HUMIDITY: 'firewood.edit.humidity',
			DATE: 'firewood.edit.date',
			LOCATION: 'firewood.edit.location',
			DELETE: 'firewood.edit.delete',
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
		this.log.error('onReady');
		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		//------------------------------------------------------
		if (this.config.telegram.users.length == 0) {
			this.log.error('There are no registered users in this instance');
			return;
		}
		for (const user of this.config.telegram.users) {
			this.log.error(user['name']);
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
			await this.setObjectNotExistsAsync('users.' + user['name'] + '.Cache', {
				type: 'state',
				common: {
					name: 'Cache',
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
				this.log.error('' + err);
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

		try {
			mySqlCon = await mysql.createConnection({
				host: this.config.database.server,
				user: this.config.database.user,
				password: this.config.database.password,
				database: this.config.database.database,
				port: this.config.database.port,
			});
		} catch (err) {
			this.log.error(err);
		}
		this.log.error('SQL start Connection');

		await this.setObjectNotExistsAsync('testVariable', {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		await this.setStateAsync('testVariable', true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync('testVariable', { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync('admin', 'iobroker');
		this.log.info('check user admin pw iobroker: ' + result);

		result = await this.checkGroupAsync('admin', 'admin');
		this.log.info('check group user admin group admin: ' + result);
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
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
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
					this.log.error('Telegram is not connected');
				}
			}
		}
	}

	async prepareRequest(user, command) {
		//let commandText = command.replace(/[^\x00-\xFF]/g,'').trim();                   //remove the emojis from the command (used to switch the command)
		//const commandText = command;
		const userMenuState = await this.getStateAsync('users.' + user + '.menu');
		const userMenu = userMenuState ? userMenuState.val : 'undefined';
		let newUserMenu = '';
		const emtyUserCache = JSON.parse('{"emty": "true"}');
		const userCacheState = await this.getStateAsync('users.' + user + '.Cache');
		let userCache = emtyUserCache;
		try {
			userCache = userCacheState ? JSON.parse(String(userCacheState.val)) : emtyUserCache;
		} catch (err) {
			this.log.error('handleRequest: UserCache could not read user Cache ' + err);
		}

		this.log.debug('userMenu: "' + userMenu + '" - userCache: "' + JSON.stringify(userCache) + '"');

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
					newUserMenu = MENU.FIREWOOD.NEW.NUMBER._;
					await this.sendMySqlToUser(user, MENU.FIREWOOD.NEW.NUMBER._);
				} else if (command == MENU.FIREWOOD.EDIT._text) {
					newUserMenu = MENU.FIREWOOD.EDIT.NUMBER;
					this.sendMySqlToUser(user, MENU.FIREWOOD.EDIT.NUMBER);
				} else if (command == MENU.FIREWOOD.STATUS._text) {
					newUserMenu = MENU.FIREWOOD.STATUS._;
					this.sendMySqlToUser(user, MENU.FIREWOOD.STATUS._);
				} else {
					newUserMenu = MENU._;
					this.sendMenuToUser(user, MENU._);
				}
				break;
			// #region FIREWOOD.New
			case MENU.FIREWOOD.NEW.NUMBER._: //Sequence - 1 - Number
				if (command == MENU.SPECIALS.ABORT) {
					newUserMenu = MENU.FIREWOOD._;
					this.sendMenuToUser(user, MENU.FIREWOOD._);
					userCache = emtyUserCache;
				} else if (parseInt(command) != 0) {
					userCache[MENU.FIREWOOD.NEW.NUMBER._] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.AMOUNT._);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.NUMBER._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.AMOUNT._: //Sequence - 2 - Amount
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.NUMBER._;
					this.sendMySqlToUser(user, MENU.FIREWOOD.NEW.NUMBER._);
					userCache = emtyUserCache;
				} else if (parseInt(command) != null) {
					userCache[MENU.FIREWOOD.NEW.AMOUNT._] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT_DETAILED._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.AMOUNT_DETAILED._);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED._: //Sequence - 3 - Amount Detailed
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.AMOUNT._);
				} else if (parseInt(command) != null) {
					userCache[MENU.FIREWOOD.NEW.AMOUNT_DETAILED._] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.TYPE._;
					this.sendMySqlToUser(user, MENU.FIREWOOD.NEW.TYPE._);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT_DETAILED._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.TYPE._: //Sequence - 4 - Type
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.AMOUNT_DETAILED._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.AMOUNT_DETAILED._);
				} else if (command != null) {
					userCache[MENU.FIREWOOD.NEW.TYPE._] = command;
					newUserMenu = MENU.FIREWOOD.NEW.HUMIDITY._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.HUMIDITY._);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.TYPE._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.HUMIDITY._: //Sequence - 5 - Humidity
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.TYPE._;
					this.sendMySqlToUser(user, MENU.FIREWOOD.NEW.TYPE._);
				} else if (parseInt(command) != null) {
					userCache[MENU.FIREWOOD.NEW.HUMIDITY._] = parseInt(command);
					newUserMenu = MENU.FIREWOOD.NEW.DATE._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.DATE._);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.HUMIDITY._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.DATE._: //Sequence - 6 - Date
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.HUMIDITY._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.HUMIDITY._);
				} else if (command != null) {
					userCache[MENU.FIREWOOD.NEW.DATE._] = textToDate(command);
					newUserMenu = MENU.FIREWOOD.NEW.LOCATION._;
					this.sendMySqlToUser(user, MENU.FIREWOOD.NEW.LOCATION._);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.DATE._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.LOCATION._: //Sequence - 7 - Location
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.DATE._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.DATE._);
				} else if (command != null) {
					userCache[MENU.FIREWOOD.NEW.LOCATION._] = command;
					newUserMenu = MENU.FIREWOOD.NEW.NOTES._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.NOTES._);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.LOCATION._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.NOTES._: //Sequence - 8 - Notes
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.LOCATION._;
					this.sendMySqlToUser(user, MENU.FIREWOOD.NEW.LOCATION._);
				} else if (command != null) {
					userCache[MENU.FIREWOOD.NEW.NOTES._] = command;
					newUserMenu = MENU.FIREWOOD.NEW.REVIEW._;
					const text = [];
					text[0] = MENU.FIREWOOD.NEW.REVIEW._text;
					text[1] = 'Nr.           : ' + userCache[MENU.FIREWOOD.NEW.NUMBER._];
					text[2] = 'Menge    : ' + userCache[MENU.FIREWOOD.NEW.AMOUNT._] + '[Ster]';
					text[3] = 'Art           : ' + userCache[MENU.FIREWOOD.NEW.TYPE._];
					text[4] = 'Feuchte  : ' + userCache[MENU.FIREWOOD.NEW.HUMIDITY._] + '%';
					text[5] = 'Lagerort : ' + userCache[MENU.FIREWOOD.NEW.LOCATION._];
					text[6] = 'Erstellt    : ' + userCache[MENU.FIREWOOD.NEW.DATE._];
					text[7] = 'Notiz       : ' + userCache[MENU.FIREWOOD.NEW.NOTES._];
					this.sendKeyboardToUser(user, text, [
						[MENU.SPECIALS.SAVE],
						[MENU.SPECIALS.BACK],
						[MENU.SPECIALS.ABORT],
					]);
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.NOTES._;
					this.sendTextToUser(user, 'Ungültige Eingabe: "' + command + '"');
				}
				break;
			case MENU.FIREWOOD.NEW.REVIEW._: //Sequence - 8 - Review
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.NEW.NOTES._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.NEW.NOTES._);
				} else if (command == MENU.SPECIALS.ABORT) {
					userCache = emtyUserCache;
					newUserMenu = MENU.FIREWOOD._;
					this.sendMenuToUser(user, MENU.FIREWOOD._);
				} else if (command == MENU.SPECIALS.SAVE) {
					if (await this.sendMySqlToUser(user, MENU.FIREWOOD.NEW.SAVE, userCache)) {
						this.sendMenuToUser(user, MENU.FIREWOOD._);
						userCache = emtyUserCache;
						newUserMenu = MENU.FIREWOOD._;
					} else {
						newUserMenu = MENU.FIREWOOD.NEW.REVIEW._;
					}
				} else {
					newUserMenu = MENU.FIREWOOD.NEW.DATE._;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
				}
				break;
			// #endregion
			// #region Firewood - Edit
			case MENU.FIREWOOD.EDIT.NUMBER:
				if (command == MENU.SPECIALS.BACK) {
					newUserMenu = MENU.FIREWOOD.EDIT._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.EDIT._);
				} else if (parseInt(command) != null) {
					userCache[MENU.FIREWOOD.EDIT.NUMBER] = command;
					newUserMenu = MENU.FIREWOOD.EDIT._;
					this.sendKeyboardToUser(user, MENU.FIREWOOD.EDIT._);
				} else {
					newUserMenu = MENU.FIREWOOD.EDIT.NUMBER;
					this.sendTextToUser(user, 'Ungültige Nummer: "' + command + '"');
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
			const WARNING =
				'handleRequest - request: "' +
				command +
				'" could not be handled; User: "' +
				user +
				'", Menu: "' +
				userMenu +
				'", Cache: "' +
				userCache;
			newUserMenu = MENU._;
			userCache = emtyUserCache;
			this.log.warn(WARNING);
			await this.sendTextToUser(user, WARNING);
			await this.sendMenuToUser(user, MENU._);
		}
		await this.setState('users.' + user + '.menu', { val: newUserMenu, ack: true });
		//console.warn(userCache);
		//console.warn(JSON.stringify(userCache));
		await this.setState('users.' + user + '.Cache', { val: JSON.stringify(userCache), ack: true });
	}

	async sendMenuToUser(user, menu) {
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

			case MENU.FIREWOOD.NEW.NUMBER._:
				text = 'Welche Nummer wurde angebracht';
				keyboard = generateNumberedChoiseKeyboard(0, 20, 1, '', '', 3, MENU.FIREWOOD._);
				break;
			default:
				text = 'sendMenuToUser: menu: "' + menu + '" is not defined';
				this.log.error(text);
				return;
		}
		this.sendKeyboardToUser(user, text, keyboard);
	}

	async sendKeyboardToUser(user, text, keyboard) {
		if (!user) {
			this.log.warn('sendTextToUser: No user defined; text: "' + text + '"');
		}

		switch (
			text //Special keyboards
		) {
			case MENU.FIREWOOD.NEW.AMOUNT._:
				text = 'Menge in Ster';
				keyboard = generateNumberedChoiseKeyboard(0, 20, 1, '', '', 3, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.AMOUNT_DETAILED._:
				text = 'Detaillierte Menge in Ster';
				keyboard = generateNumberedChoiseKeyboard(0, 75, 25, '', '', 2, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.HUMIDITY._:
				text = 'Feuchtigkeit in %';
				keyboard = generateNumberedChoiseKeyboard(5, 30, 1, '', '%', 5, MENU.SPECIALS.BACK);
				break;
			case MENU.FIREWOOD.NEW.DATE._:
				text = 'Anlage / Änderungsdatum';
				keyboard = generateKeyboard(
					['heute', 'gestern', 'letzteWoche', 'vorletzteWoche', 'letztenMonat', MENU.SPECIALS.BACK],
					1,
				);
				break;
			case MENU.FIREWOOD.NEW.NOTES._:
				text = 'Notizen (optional)';
				keyboard = generateKeyboard(['Überspringen', MENU.SPECIALS.BACK], 1);
				break;
			default:
				if (!keyboard) {
					this.sendTextToUser(user, 'Spezial Keyboard: "' + text + '" is not existing');
					return;
				}
				break;
		}
		let displayText = '';
		console.log(text);
		if (Array.isArray(text)) {
			for (let i = 0; i < text.length; i++) {
				displayText += text[i] + '\n';
			}
			text = displayText; //To avoid using the unformatted "text" variable
		}
		console.log(displayText);

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

	async sendMySqlToUser(user, sqlFunction, parameters) {
		try {
			switch (sqlFunction) {
				case MENU.FIREWOOD.NEW.NUMBER._: {
					//Show the menue to select a free number
					const [result] = await mySqlCon.query('SELECT DISTINCT nr FROM wood WHERE activ > 0 ORDER BY nr');
					const arrAnswers = [];
					let resultCount = 0;
					let answersCount = 0;
					let testedInt = 1;
					while (answersCount < 20) {
						//Generate 20 free numers, that are not active in use
						if (result[resultCount].nr != testedInt) {
							arrAnswers[answersCount] = testedInt;
							answersCount++;
						} else if ((result[resultCount].nr = testedInt && result.length > resultCount + 1)) {
							resultCount++;
						}
						testedInt++;
					}
					const keyboard = generateKeyboard(arrAnswers, 3, MENU.SPECIALS.ABORT);
					await this.sendKeyboardToUser(user, 'Welche Nummer wurde angebraucht?', keyboard);
					break;
				}
				case MENU.FIREWOOD.EDIT.NUMBER: {
					//Edit a wood Number: => Update the row, if the latest dateMod is today; add a new row if not
					const [result] = await mySqlCon.query('SELECT DISTINCT nr FROM wood WHERE activ > 0 ORDER BY nr');
					const arrAnswers = [];
					for (let i = 0; i < result.length; i++) {
						//Select all used Numbers
						arrAnswers[i] = result[i].nr;
					}
					const keyboard = generateKeyboard(arrAnswers, 3, MENU.SPECIALS.ABORT);

					this.sendKeyboardToUser(user, 'welche Nummer wurde angebracht?', keyboard);
					break;
				}
				case MENU.FIREWOOD.NEW.TYPE._: {
					// Ask for the type
					const [result] = await mySqlCon.query(
						'SELECT propertyText FROM wood_datapoints WHERE propertyInt < 100',
					);
					const arrAnswers = [];
					for (let i = 0; i < result.length; i++) {
						arrAnswers[i] = result[i].propertyText;
					}
					const keyboard = generateKeyboard(arrAnswers, 1, MENU.SPECIALS.BACK);
					this.sendKeyboardToUser(user, 'Holzart', keyboard);
					break;
				}
				case MENU.FIREWOOD.NEW.SAVE: {
					//Create the new entry
					const [maxId] = await mySqlCon.query('SELECT MAX(id) As id FROM wood');
					const sql = 'INSERT INTO wood (id, activ, nr, amount, typ, dateMod, humidity, notes, location) ';
					const arrValues = [
						String(maxId[0].id + 1),
						'2',
						String(parameters[MENU.FIREWOOD.NEW.NUMBER._]),
						String(parameters[MENU.FIREWOOD.NEW.AMOUNT._]),
						String(parameters[MENU.FIREWOOD.NEW.TYPE._]),
						String(parameters[MENU.FIREWOOD.NEW.DATE._]),
						String(parameters[MENU.FIREWOOD.NEW.HUMIDITY._]),
						String(parameters[MENU.FIREWOOD.NEW.NOTES._]),
						String(parameters[MENU.FIREWOOD.NEW.LOCATION._]),
					];
					const values = generateSqlValues(arrValues);
					console.log(sql);
					console.log(values);
					const [result] = await mySqlCon.query(sql + values);
					console.log(result);
					if (result.warningStatus == '') {
						this.sendTextToUser(user, 'Neuer Eintrag wurde erfolgreich gespeichert');
					}
					break;
				}
				case MENU.FIREWOOD.NEW.LOCATION._: {
					//Ask for the location
					const [result] = await mySqlCon.query(
						'SELECT propertyText FROM wood_datapoints WHERE propertyInt > 100 AND propertyInt < 200',
					);
					const arrAnswers = [];
					for (let i = 0; i < result.length; i++) {
						arrAnswers[i] = result[i].propertyText;
					}
					const keyboard = generateKeyboard(arrAnswers, 2, MENU.SPECIALS.BACK);
					this.sendKeyboardToUser(user, 'Lagerort', keyboard);
					break;
				}
				case MENU.FIREWOOD.STATUS._: {
					//Calculate statistics
					const [result] = await mySqlCon.query(
						'SELECT id, nr, amount, 	(SELECT propertyText FROM wood_datapoints WHERE wood.typ = wood_datapoints.propertyInt) AS typ, humidity, ' +
							'(SELECT dateMod FROM wood w1 WHERE w1.Id = wood.Id ORDER BY dateMod DESC LIMIT 1) AS dateCreation, ' +
							'(SELECT propertyText FROM wood_datapoints WHERE wood.location = wood_datapoints.propertyInt) AS location ' +
							'FROM wood WHERE activ > 1 ORDER BY humidity',
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
								result[i].location,
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

					this.sendTextToUser(user, text);
					break;
				}
				default: {
					const WARNING =
						'sendMySqlToUser: sqlFunction: "' +
						sqlFunction +
						'" could not be found; User: "' +
						user +
						'", parameters: "' +
						parameters +
						'"';
					this.log.warn(WARNING);
					await this.sendTextToUser(user, WARNING);
					break;
				}
			}
		} catch (err) {
			this.log.error(String(err));
			this.sendTextToUser(user, 'sendMySqlToUser: "' + sqlFunction + '" - ' + err);
			this.sendTextToUser(user, 'Parameters' + JSON.stringify(parameters));
			return false;
		}
		return true;
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
