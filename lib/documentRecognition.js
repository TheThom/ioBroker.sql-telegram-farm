const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const MENU = require('./menu.json');
const tesseract = require('node-tesseract-ocr');
const sharp = require('sharp');
const fuse = require('fuse.js');

const genAI = new GoogleGenAI({ apiKey: 'AIzaSyDMYJMFqoOzyP9EHtob5UuM1xdejnB9NRc' });

const TELEGRAM_NODE = 'telegram.';

class docRec {
	constructor(options) {
		this.options = options || {};
		this.config = options.adapter.adapterConfig.native;
		this.adapter = options.adapter;
	}

	async recognice(user, userCache) {
		const type = userCache[MENU.DIALOG.DOCREC.TYPE._];
		try {
			switch (type) {
				case MENU.DIALOG.DOCREC.TYPE.DEBUG: {
					const base64Data = fs.readFileSync(userCache[MENU.DIALOG.DOCREC.FILE._]).toString('base64');
					try {
						this.sendTextToUser(user, 'einlesen..');
						const result = await genAI.models.generateContent({
							model: 'gemini-2.0-flash', // Aktuellstes Modell
							contents: [
								{
									role: 'user',
									parts: [
										{ text: 'Gib den Kassenbeleg in JSON aus' },
										{
											inlineData: {
												data: base64Data,
												mimeType: 'image/jpeg',
											},
										},
									],
								},
							],
						});
						const resultTextString = result.text
							? result.text.replace(/```json|```/g, '').trim()
							: '{"store_name" : "noResult"}';
						const resultTextJson = JSON.parse(resultTextString);
						this.adapter.log.warn(JSON.stringify(resultTextJson));

						//Make sure all fields exists:
						for (const item in resultTextJson.items) {
							this.adapter.log.warn(resultTextJson.items[item].name);
							resultTextJson.items[item].quantity = resultTextJson.items[item].quantity
								? resultTextJson.items[item].quantity
								: '1';
							resultTextJson.items[item].name = resultTextJson.items[item].name
								? resultTextJson.items[item].name
								: 'null';
							resultTextJson.items[item].price = resultTextJson.items[item].price
								? resultTextJson.items[item].price
								: 'null';
							resultTextJson.items[item].item_id = resultTextJson.items[item].item_id
								? resultTextJson.items[item].item_id
								: 'null';
						}

						resultTextJson.store_name = resultTextJson.store_name ? resultTextJson.store_name : 'null';
						resultTextJson.total = resultTextJson.total ? resultTextJson.total : 'null';
						resultTextJson.store_address = resultTextJson.store_address
							? resultTextJson.store_address
							: 'null';
						resultTextJson.date = resultTextJson.date ? resultTextJson.date : '01.01.2000';
						resultTextJson.time = resultTextJson.time ? resultTextJson.time : '00:00 Uhr';

						const text = [];
						text.push('### Kassenbeleg ###');
						text.push(resultTextJson.store_name);
						text.push(resultTextJson.store_address);
						text.push(resultTextJson.date + ' ' + resultTextJson.time);

						text.push('SUMME:' + resultTextJson.total + '€');
						text.push(' ');
						for (const item of resultTextJson.items) {
							text.push(item.price + ' ' + item.quantity + 'x ' + item.name);
						}
						await this.sendTextToUser(user, text);
					} catch (error) {
						this.adapter.log.warn('Fehler: ' + String(error));
					}

					return 'true';
					/*		const tesseractConfig = {
						lang: 'deu',
						oem: 1,
						psm: 6,
					};

					const { data, info } = await sharp(userCache[MENU.DIALOG.DOCREC.FILE._])
						.greyscale()
						.resize(1600)
						.toBuffer({ resolveWithObject: true });
					const preparedImage = data;
					const rawTextString = await tesseract.recognize(preparedImage, tesseractConfig);
					const rawTextArray = rawTextString.split('\n');

					await this.sendTextToUser(user, 'aa');
					await this.sendTextToUser(user, rawTextArray);
					this.adapter.log.warn('rawTextString:');
					this.adapter.log.warn(rawTextString);

					const fuseConfig = {
						threshold: 0.4,
						ignoreLocation: true,
						includeScore: true,
					};
					const rawTextFuse = new (fuse.default || fuse)(rawTextArray, fuseConfig);
					this.adapter.log.warn('rawTextFuse');
					this.adapter.log.warn(JSON.stringify(rawTextFuse));

					const diesel = rawTextFuse.search('Diesel');
					this.adapter.log.warn('Diesel');
					this.adapter.log.warn(JSON.stringify(diesel));

					const benzin = rawTextFuse.search('Benzin');
					this.adapter.log.warn('Benzin');
					this.adapter.log.warn(JSON.stringify(benzin));

					await this.sendTextToUser(user, String(diesel));
					return String(diesel);
					*/
				}

				default:
					this.sendTextToUser(user, 'docRec: recognice "' + type + '"not available');
					this.sendTextToUser(user, 'Parameters: "' + JSON.stringify(userCache) + '"');
					return false;
			}
		} catch (err) {
			this.adapter.log.error(String(err));
			this.sendTextToUser(user, 'docRec: "' + type + '" - ' + err);
			this.sendTextToUser(user, 'Parameters: "' + JSON.stringify(userCache) + '"');
		}
		return false;
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
		//displayText = displayText.substring(0, 4095); //Max Limit of Text is 4096
		const SPECIAL_CHARS = [
			// '\\',
			'_',
			//'*',
			'[',
			']',
			//'(',
			//')',
			'~',
			'`',
			'>',
			'<',
			//	'&',
			//'#',
			'+',
			//'-',
			'=',
			//'|',
			'{',
			'}',
			//	'.',
			//'!',
		]; //Take care of special characters
		for (const num in SPECIAL_CHARS) {
			displayText = displayText.replaceAll(SPECIAL_CHARS[num], '[Invalid]');
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

/*
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
	*/
module.exports = docRec;
