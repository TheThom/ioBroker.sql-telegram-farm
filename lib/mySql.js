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

	async set(user, sqlFunction, parameters) {
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
						const sql =
							'INSERT INTO wood (id, activ, nr, amount, typ, dateMod, humidity, notes, location, user) ';
						const arrValues = [
							String(parameters[MENU.FIREWOOD.EDIT.ID._]),
							'2',
							String(parameters[MENU.FIREWOOD.EDIT.NUMBER._]),
							String(parameters[MENU.FIREWOOD.EDIT.AMOUNT_DETAILED._]),
							String(parameters[MENU.FIREWOOD.EDIT.TYPE._]),
							createDateTime(),
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
				}
				case MYSQL.SET.FIREWOOD.DELETE: {
					const sql = 'UPDATE wood SET activ="0" WHERE id="' + parameters[MENU.FIREWOOD.EDIT.ID._] + '"';
					const [result] = await mySqlCon.query(sql);
					if (result.warningStatus == '') {
						return true;
					}
					return false;
				}

				case MYSQL.SET.MACHINES.ADD_USE: {
					const machineId = await this.get(user, MYSQL.GET.MACHINES.MACHINEID, parameters);
					const sql = 'INSERT into machine_use (dateUse, machineId, hoursUse, user) ';
					const arrValues = [
						createDateTime(),
						String(machineId),
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.ACTIONS_USE._]),
						String(user),
					];
					const values = generateSqlValues(arrValues);
					const [result] = await mySqlCon.query(sql + values);
					if (result.warningStatus == '') {
						return true;
					}
					return false;
				}

				case MYSQL.SET.MACHINES.MAINTENANCE.DONE: {
					const maintenanceId = await this.get(user, MYSQL.GET.MACHINES.MAINTENANCE.ID, parameters);
					const sql = 'INSERT into machine_maintenance_done (maintenanceId, maintenanceDate, notes, user) ';
					const arrValues = [
						String(maintenanceId),
						createDateTime(),
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.NOTE._]),
						String(user),
					];
					const values = generateSqlValues(arrValues);
					const [result] = await mySqlCon.query(sql + values);
					if (result.warningStatus == '') {
						return true;
					}
					return false;
				}

				case MYSQL.SET.MACHINES.MAINTENANCE.SAVE_EDIT: {
					/*		let sql =
						'SELECT maintenanceId FROM machine_maintenance_plan  WHERE maintenanceId="' +
						parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] +
						'"';
					const [existsResult] = await mySqlCon.query(sql);
					//Insert the new row
					if (existsResult != '') {
						sql =
							'UPDATE machine_maintenance_plan SET (machineId, activ, intervalHoursUse, intervalMonth, title, description) WHERE maintenanceId="' +
							String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._]) +
							'"';
					} else {*/
					const sql =
						'REPLACE INTO machine_maintenance_plan (maintenanceId, machineId, activ, intervalHoursUse, intervalMonth, title, description)';
					//		}
					const arrValues = [
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._]),
						String(await this.get(user, MYSQL.GET.MACHINES.MACHINEID, parameters)),
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._]),
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._]),
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._]),
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._]),
						String(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._]),
					];
					const values = generateSqlValues(arrValues);
					console.log(sql + values);
					const [result] = await mySqlCon.query(sql + values);
					if (result.warningStatus == '') {
						return true;
					}
					return false;
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
	async get(user, sqlFunction, parameters) {
		try {
			//#region FIREWOOD
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
						'SELECT id AS idTemp, id, nr, amount, typ, humidity, notes, location, ' +
							'(SELECT dateMod FROM wood WHERE activ >0 and id=idTemp ORDER BY dateMod LIMIT 1) AS dateCreate ' +
							'FROM wood WHERE activ = 2 ORDER BY humidity',
					);

					const [resultStat] = await mySqlCon.query(
						'SELECT SUM(amount) AS amountTotal, ' +
							'(SELECT SUM(amount) FROM wood WHERE humidity < 18 AND activ = 2) AS amountFinished, ' +
							'Round(AVG(humidity),1) AS humidityAvg ' +
							'FROM wood WHERE activ = 2',
					);

					const text = [];
					text[0] = '<b>Brennholzstatus:</b>    ' + createDateTime();
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
								result[i].dateCreate.getUTCFullYear() +
								'_' +
								(result[i].dateCreate.getUTCMonth() + 1) +
								' ' +
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

				//#endregion
				//#region MACHINES
				case MYSQL.GET.MACHINES.CATEGORY: {
					const [arrNr] = await mySqlCon.query(
						'SELECT DISTINCT category FROM machine_datapoints WHERE activ=1 ORDER BY category',
					);
					const result = [];
					for (const count in arrNr) {
						result.push(String(arrNr[count].category));
					}
					return result;
				}
				case MYSQL.GET.MACHINES.MACHINEID: {
					const [machineId] = await mySqlCon.query(
						'SELECT machineId FROM machine_datapoints WHERE activ=1 AND category="' +
							parameters[MENU.MACHINES_CATEGORY._] +
							'" AND machineName="' +
							parameters[MENU.MACHINES_CATEGORY.MACHINE._] +
							'"',
					);
					return machineId[0].machineId;
				}
				case MYSQL.GET.MACHINES.MAINTENANCE.ID: {
					const machineId = await this.get(user, MYSQL.GET.MACHINES.MACHINEID, parameters);
					console.log(machineId);
					const [maintenanceId] = await mySqlCon.query(
						'SELECT maintenanceId FROM machine_maintenance_plan WHERE machineId="' +
							machineId +
							'" AND title="' +
							parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE._] +
							'"',
					);
					console.log(parameters);
					return maintenanceId[0].maintenanceId;
				}
				case MYSQL.GET.MACHINES.MAINTENANCE.FREE_ID: {
					const machineId = await this.get(user, MYSQL.GET.MACHINES.MACHINEID, parameters);
					const [maintenanceId] = await mySqlCon.query(
						'SELECT IFNULL(' +
							'(SELECT(maintenanceId + 1) FROM machine_maintenance_plan WHERE machineId="' +
							machineId +
							'" ORDER BY maintenanceId DESC LIMIT 1),' +
							'(SELECT ' +
							machineId +
							'*10+1)) AS maintenanceId',
					);
					console.log('mtId' + maintenanceId[0].maintenanceId);

					return maintenanceId[0].maintenanceId;
				}
				case MYSQL.GET.MACHINES.MAINTENANCE.ALL_IDS: {
					const [allMaintenanceIds] = await mySqlCon.query(
						'SELECT maintenanceId FROM machine_maintenance_plan',
					);
					const result = [];
					for (const id of allMaintenanceIds) {
						result.push(id.maintenanceId);
					}
					return result;
				}
				case MYSQL.GET.MACHINES.MACHINES: {
					const [arrNr] = await mySqlCon.query(
						'SELECT machineName FROM machine_datapoints WHERE activ=1 AND category="' +
							parameters[MENU.MACHINES_CATEGORY._] +
							'" ORDER BY machineName',
					);
					const result = [];
					for (const count in arrNr) {
						result.push(String(arrNr[count].machineName));
					}
					return result;
				}
				case MYSQL.GET.MACHINES.MAINTENANCE.MAINTENANCE: {
					const machineId = await this.get(user, MYSQL.GET.MACHINES.MACHINEID, parameters);
					const [maintenance] = await mySqlCon.query(
						'SELECT 	machineId,' +
							'maintenanceId, ' +
							'IFNULL(intervalHoursUse ' +
							'- (SELECT SUM(hoursUse) ' +
							'	FROM machine_use' +
							'	WHERE machineId="' +
							machineId +
							'"' +
							'	AND machine_use.dateUse > ( ' +
							'		SELECT max(machine_maintenance_done.maintenanceDate) ' +
							'		FROM machine_maintenance_done' +
							'		WHERE machine_maintenance_done.maintenanceId = machine_maintenance_plan.maintenanceId)), 0)' +
							'AS hoursLeft, ' +
							'IFNULL(TIMESTAMPDIFF(MONTH, CURDATE(), ADDDATE((' +
							'	SELECT max(maintenanceDate) ' +
							'		FROM machine_maintenance_done ' +
							'		WHERE machine_maintenance_plan.maintenanceId = machine_maintenance_done.maintenanceId), ' +
							'	INTERVAL machine_maintenance_plan.intervalMonth MONTH))' +
							', 0)AS monthsLeft,' +
							'title FROM machine_maintenance_plan WHERE machineId="' +
							machineId +
							'";',
					);

					const result = [];
					for (let i = 0; i < maintenance.length; i++) {
						result.push(
							'<' +
								maintenance[i].monthsLeft +
								'M ' +
								maintenance[i].hoursLeft +
								'h> ' +
								maintenance[i].title,
						);
					}
					return result;
				}
				case MYSQL.GET.MACHINES.MAINTENANCE.DESCRIPTION: {
					const [description] = await mySqlCon.query(
						'SELECT description FROM machine_maintenance_plan WHERE maintenanceId="' +
							parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] +
							'";',
					);
					console.log(description);
					return description[0].description;
				}
				case MYSQL.GET.MACHINES.MAINTENANCE.DATASET_BY_ID: {
					console.warn(parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._]);
					const [details] = await mySqlCon.query(
						'SELECT title, description, activ, intervalHoursUse, intervalMonth FROM machine_maintenance_plan WHERE maintenanceId="' +
							parameters[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID._] +
							'";',
					);
					const result = {};
					result[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.TITLE._] = details[0].title;
					result[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.DESCRIPTION._] = details[0].description;
					result[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.ACTIV._] = details[0].activ;
					result[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_HOUR._] =
						details[0].intervalHoursUse;
					result[MENU.MACHINES_CATEGORY.MACHINE.MAINTENACE.ID.EDIT.INTERVAL_MONTH._] =
						details[0].intervalMonth;
					return result;
				}
				case MYSQL.GET.MACHINES.MAINTENANCE.TODO: {
					const [maintenance] = await mySqlCon.query(
						'SELECT 	machineId,' +
							'maintenanceId, ' +
							'IFNULL(intervalHoursUse ' +
							'- (SELECT SUM(hoursUse) ' +
							'	FROM machine_use' +
							'	WHERE machine_use.dateUse > ( ' +
							'		SELECT max(machine_maintenance_done.maintenanceDate) ' +
							'		FROM machine_maintenance_done' +
							'		WHERE machine_maintenance_done.maintenanceId = machine_maintenance_plan.maintenanceId)), 0)' +
							'AS hoursLeft, ' +
							'IFNULL(TIMESTAMPDIFF(MONTH, CURDATE(), ADDDATE((' +
							'	SELECT max(maintenanceDate) ' +
							'		FROM machine_maintenance_done ' +
							'		WHERE machine_maintenance_plan.maintenanceId = machine_maintenance_done.maintenanceId), ' +
							'	INTERVAL machine_maintenance_plan.intervalMonth MONTH))' +
							', 0)AS monthsLeft,' +
							'title FROM machine_maintenance_plan' +
							';',
					);

					const text = [];
					text.push('<b>Überfällige Wartungen:</b>    ' + createDateTime());
					text.push(' ');
					text.push('<code>');
					for (let i = 0; i < maintenance.length; i++) {
						if (maintenance[i].monthsLeft < 1 || maintenance[i].hoursLeft < 0) {
							text.push(maintenance[i].machineId + maintenance[i].maintenanceId);
							text.push(
								'' +
									maintenance[i].monthsLeft +
									'M ' +
									maintenance[i].hoursLeft +
									'h ' +
									maintenance[i].title,
							);
							text.push('');
						}
					}
					text.push('</code>');
					return text;
				}
				case MYSQL.GET.MACHINES.HISTORY: {
					const machineId = await this.get(user, MYSQL.GET.MACHINES.MACHINEID, parameters);
					const [resultStat] = await mySqlCon.query(
						'SELECT SUM(hoursUse) AS durationTotal, ROUND(AVG(hoursUse),1) AS durationAvg FROM machine_use WHERE machineId="' +
							machineId +
							'"',
					);
					const [history] = await mySqlCon.query(
						'SELECT DATE_FORMAT(dateUse, "%Y-%m-%d") as dateUse, hoursUse, user FROM machine_use WHERE machineId="' +
							machineId +
							'" ORDER BY dateUse',
					);
					const hourMeterOffset = await this.get(user, MYSQL.GET.MACHINES.HOUR_METER_OFFSET, parameters);

					const text = [];
					text.push(
						'Verlauf von: "<b>' +
							parameters[MENU.MACHINES_CATEGORY.MACHINE._] +
							'</b>"     ' +
							createDateTime(),
					);
					text.push(' ');
					if (hourMeterOffset != 0) {
						text.push('Offset Betriebsstundenzähler: <b>' + hourMeterOffset + 'h</b>');
					}
					text.push('<code>');
					for (let i = 0; i < history.length; i++) {
						text.push(history[i].dateUse + '  ' + history[i].hoursUse + 'h  - ' + history[i].user + '\r\n');
					}

					text.push('\n');
					text.push('</code>');
					text.push('#####################');
					text.push('###<b> Zusammenfassung</b>###');
					text.push('#####################');
					text.push('<code>');
					//Enter Statistics
					text.push(
						'Stunden gesamt    : </code><span class="tg-spoiler">' +
							(parseFloat(resultStat[0].durationTotal) + parseFloat(hourMeterOffset)) +
							'h</span><code>',
					);
					text.push(
						'Durchschn. Dauer  : </code><span class="tg-spoiler">' +
							resultStat[0].durationAvg +
							'h</span><code>',
					);
					text.push('</code>');

					return text;
				}
				case MYSQL.GET.MACHINES.HOUR_METER_OFFSET: {
					const machineId = await this.get(user, MYSQL.GET.MACHINES.MACHINEID, parameters);
					const [hourMeterOffset] = await mySqlCon.query(
						'SELECT hourMeterOffset FROM machine_datapoints WHERE machineId="' + machineId + '"',
					);
					return hourMeterOffset[0].hourMeterOffset;
				}

				//#endregion

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
				//this.log.warn('mySqlCreateConnection() - State: "' +mySqlCon.state + '"');

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

function createDateTime() {
	const date = new Date(Date.now());
	return (
		date.getUTCFullYear() +
		'-' +
		(date.getUTCMonth() + 1) +
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
module.exports = mySql;
