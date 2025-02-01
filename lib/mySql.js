const mysql = require('mysql2/promise');

const MENU = require('./menu.json');
const MYSQL = require('./mySql.json');

const TELEGRAM_NODE = 'telegram.';

let mySqlCon;

class mySql {
	constructor(options) {
		this.options = options || {};
		this.config = options.adapter.adapterConfig.native;
		this.adapter = options.adapter;
		this.mySqlEnsureConnection();
	}
	async setMySql(user, sqlFunction, parameters) {
		try {
			await this.mySqlEnsureConnection(user);
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
				const [result] = awaitmySqlCon.query(sql);
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
			this.adapter.log.error(String(err));
			this.sendTextToUser(user, 'setMySql: "' + sqlFunction + '" - ' + err);
			this.sendTextToUser(user, 'Parameters: "' + JSON.stringify(parameters) + '"');
		}
		return false;
	}
	async getMySql(user, sqlFunction, parameters) {
		try {
			await this.mySqlEnsureConnection(user);
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
					/*	const [result] = awaitmySqlCon.query(
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
					this.adapter.log.warn(WARNING);
					this.sendTextToUser(user, WARNING);
					break;
				}
			}
		} catch (err) {
			this.adapter.log.error(String(err));
			this.sendTextToUser(user, 'getMySql: "' + sqlFunction + '" - ' + err);
			this.sendTextToUser(user, 'Parameters' + JSON.stringify(parameters));
		}
		return ['noResults'];
	}

	async mySqlEnsureConnection(user) {
		try {
			mySqlCon.query('SELECT 1');
		} catch (error) {
			try {
				//	this.log.warn('mySqlCreateConnection() - State: "' +mySqlCon.state + '"');

				mySqlCon = await mysql.createConnection({
					host: this.config.database.server,
					user: this.config.database.user,
					password: this.config.database.password,
					database: this.config.database.database,
					port: this.config.database.port,
				});
				this.adapter.log.info('SQL Connection created');
			} catch (err) {
				this.adapter.log.error(err);
				if (user) {
					this.sendTextToUser(
						user,
						'mySQLCreateConnection: Verbindung zur Datenbank nicht möglich: "' + err + '"',
					);
				}
			}
		}
	}
	async sendTextToUser(user, text) {
		let displayText = '';
		if (!user) {
			this.adapter.log.warn('sendTextToUser: No user defined; text: "' + text + '"');
		}

		if (Array.isArray(text)) {
			for (let i = 0; i < text.length; i++) {
				displayText += text[i] + '\n';
			}
		} else {
			displayText = text;
		}
		this.adapter.sendTo(
			TELEGRAM_NODE + this.config.telegram.instance,
			'send',
			{
				text: displayText,
				user: user,
				parse_mode: 'html',
			},
			(instance, message) => {
				if (message) {
					this.adapter.log.error('sendTextToUser:' + instance + message);
				}
			},
		);
	}
}
function generateSqlValues(arrValues) {
	let result = ' VALUES(';
	for (const count in arrValues) {
		result = result + "'" + arrValues[count] + "', ";
	}
	result = result?.substring(0, result.length - 2) + ')';
	return result;
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
/*
function generateSqlValues(arrValues) {
	let result = ' VALUES(';
	for (const count in arrValues) {
		result = result + "'" + arrValues[count] + "', ";
	}
	result = result?.substring(0, result.length - 2) + ')';
	return result;
}
*/
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
module.exports = mySql;
