const fs = require('fs');
const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch'); // Wird von der Dropbox-Bibliothek für Node.js benötigt

const TELEGRAM_NODE = 'telegram.';

const FOLDER = require('./folder.json');

class backup {
	constructor(options) {
		this.options = options || {};
		this.config = options.adapter.adapterConfig.native;
		this.adapter = options.adapter;
		this.dbx = new Dropbox({
			clientId: this.config.database.backup.dropbox.clientId,
			clientSecret: this.config.database.backup.dropbox.clientSecret,
			refreshToken: this.config.database.backup.dropbox.refreshToken,
			fetch: fetch,
		});
	}
	async backupToDropbox(user) {
		try {
			// Test: Erzeuge einen leeren 8MB Buffer im RAM ohne Festplatten-Zugriff
			const chunk = Buffer.alloc(8 * 1024 * 1024, 'a');

			await this.sendTextToUser(user, 'Starte Test-Upload mit RAM-Buffer...');
			await this.dbx.filesUploadSessionStart({
				close: false,
				contents: chunk, // Nutze den RAM-Buffer statt der echten Datei
			});
			await this.sendTextToUser(user, 'Erster Chunk erfolgreich!');

			/*
			await this.sendTextToUser(user, 'Zip Dateien erstellen...');
			const { zip } = await import('zip-a-folder');

			const today = new Date();
			const formattedDate =
				today.getFullYear() +
				'_' +
				String(today.getMonth() + 1).padStart(2, '0') +
				'_' +
				String(today.getDate()).padStart(2, '0');
			const pathZip =
				this.config.database.filepath + FOLDER.BACKUP.LOCAL.STORAGE + formattedDate + '_farm_backup';
			console.warn(pathZip);
			await zip(this.config.database.filepath + FOLDER.BACKUP.LOCAL.FOLDERS, pathZip);
			await this.sendTextToUser(user, 'ZIP-Datei erstellt - Upload zu Dropbox...');

			const dropboxPath = FOLDER.BACKUP.CLOUD + formattedDate + '_farm_backup.zip';
			await this.uploadLargeZip(pathZip, dropboxPath);

			if (fs.existsSync(pathZip)) {
				fs.unlinkSync(pathZip);
			}
			await this.sendTextToUser(
				user,
				'###################\r\nBackup erfolgreich erstellt:\r\n###################',
			);
			*/
		} catch (error) {
			let errorMessage = 'Unbekannter Fehler';

			// 1. Prüfen, ob es ein strukturierter Dropbox-API-Fehler ist
			if (error && error.error) {
				const apiError = error.error;

				// Kurzer technischer Code (z.B. "path/conflict/file/...")
				const summary = apiError.error_summary || error.error || 'Keine Zusammenfassung';

				// Detail-Tag auslesen (z.B. "insufficient_space" oder "malformed_path")
				let details = '';
				if (apiError.error && apiError.error['.tag']) {
					details = ` (Grund: ${apiError.error['.tag']})`;
				} else if (typeof apiError.error === 'string') {
					details = ` (${apiError.error})`;
				}

				errorMessage = `Dropbox API Fehler: ${summary}${details}`;
			}
			// 2. Prüfen, ob es ein Standard-HTTP- oder Netzwerkfehler ist (z.B. Status 401)
			else if (error && error.status) {
				errorMessage = `HTTP-Fehler ${error.status}: ${error.message || 'Keine Nachricht'}`;
			}
			// 3. Allgemeiner JavaScript-Fehler
			else if (error && error.message) {
				errorMessage = `Systemfehler: ${error.message}`;
			}

			await this.sendTextToUser(user, '###############\r\n!!! Backup fehlgeschlagen: !!!\r\n###############');

			await this.sendTextToUser(user, errorMessage);
			await this.sendTextToUser(user, JSON.stringify(error));
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

	async uploadLargeZip(pathZip, dropboxPath) {
		// 1. Session starten
		const sessionId = await this.dbx
			.filesUploadSessionStart({
				close: false,
				contents: '',
			})
			.then((response) => response.result.session_id);

		const stats = fs.statSync(pathZip);
		const fileSize = stats.size;
		const chunkSize = 8 * 1024 * 1024; // 8 MB Chunks
		let offset = 0;

		const fileDescriptor = fs.openSync(pathZip, 'r');
		const buffer = Buffer.alloc(chunkSize);

		try {
			while (offset < fileSize) {
				const bytesRead = fs.readSync(fileDescriptor, buffer, 0, chunkSize, offset);
				const chunk = buffer.subarray(0, bytesRead);

				const isLastChunk = offset + bytesRead >= fileSize;

				if (!isLastChunk) {
					// Zwischenstücke hochladen
					await this.dbx.filesUploadSessionAppendV2({
						cursor: { session_id: sessionId, offset: offset },
						close: false,
						contents: chunk,
					});
				} else {
					// Letztes Stück hochladen und Datei finalisieren
					await this.dbx.filesUploadSessionFinish({
						cursor: { session_id: sessionId, offset: offset },
						commit: { path: dropboxPath, mode: 'overwrite' },
						contents: chunk,
					});
				}

				offset += bytesRead;
			}
			console.log('Backup erfolgreich hochgeladen!');
		} finally {
			fs.closeSync(fileDescriptor);
		}
	}
}

module.exports = backup;

/* Große Backups in Chunks uploaden über einen Stream


const fs = require('fs');
const path = require('path');
const { Dropbox } = require('dropbox');
require('isomorphic-fetch');

class Backup {
    constructor(options) {
        this.options = options || {};
        this.config = options.adapter.adapterConfig.native;
        this.adapter = options.adapter;

        // Dropbox-Client initialisieren
        this.dbx = new Dropbox({ accessToken: this.config.dropboxToken });
    }

    async backupToDropbox() {
        let targetZipPath = '';
        try {
            // 1. Dynamischer Import von 'zip-a-folder' (da ES-Modul)
            const { zip } = await import('zip-a-folder');

            const sourcePath = this.config.database.filepath;
            targetZipPath = path.join(sourcePath, '..', 'backup.zip'); 

            this.log('info', 'Starte ZIP-Komprimierung...');
            await zip(sourcePath, targetZipPath);
            this.log('info', 'ZIP-Datei erfolgreich lokal erstellt.');

            // 2. Dateigröße prüfen
            const stats = fs.statSync(targetZipPath);
            const fileSize = stats.size;
            const maxBlob = 150 * 1024 * 1024; // 150 MB Dropbox-Limit für Single Upload
            const dropboxPath = '/Backups/backup.zip';

            if (fileSize < maxBlob) {
                // Standard-Upload für kleinere Dateien
                this.log('info', `Lade Datei hoch (Standard-Upload, Größe: ${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);
                const fileContent = fs.readFileSync(targetZipPath);
                await this.dbx.filesUpload({
                    path: dropboxPath,
                    contents: fileContent,
                    mode: 'overwrite'
                });
            } else {
                // Chunk-Upload für große Dateien (> 150 MB)
                this.log('info', `Datei ist groß (${(fileSize / 1024 / 1024).toFixed(2)} MB). Starte Chunk-Upload...`);
                await this.uploadLargeFile(targetZipPath, dropboxPath, fileSize);
            }

            this.log('info', `Erfolgreich in Dropbox gespeichert unter: ${dropboxPath}`);

            // 3. Temporäre lokale ZIP-Datei aufräumen
            if (fs.existsSync(targetZipPath)) {
                fs.unlinkSync(targetZipPath);
            }

        } catch (error) {
            // Lokale Datei auch im Fehlerfall aufräumen
            if (targetZipPath && fs.existsSync(targetZipPath)) {
                fs.unlinkSync(targetZipPath);
            }
            this.log('error', `Fehler beim Dropbox-Backup: ${error.message}`);
        }
    }

    // Hilfsmethode für den segmentierten Upload großer Dateien
    async uploadLargeFile(localPath, dropboxPath, fileSize) {
        const chunkSize = 10 * 1024 * 1024; // 10 MB Chunks
        const fd = fs.openSync(localPath, 'r');
        const buffer = Buffer.alloc(chunkSize);
        let offset = 0;
        let sessionId = null;

        while (offset < fileSize) {
            const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, offset);
            const chunk = buffer.subarray(0, bytesRead);

            if (offset === 0) {
                // Session starten
                const response = await this.dbx.filesUploadSessionStart({ close: false, contents: chunk });
                sessionId = response.result.session_id;
            } else if (offset + bytesRead < fileSize) {
                // Mittlere Chunks anhängen
                await this.dbx.filesUploadSessionAppendV2({
                    cursor: { session_id: sessionId, offset: offset },
                    close: false,
                    contents: chunk
                });
            } else {
                // Letzten Chunk hochladen und abschließen
                await this.dbx.filesUploadSessionFinish({
                    cursor: { session_id: sessionId, offset: offset },
                    commit: { path: dropboxPath, mode: 'overwrite' },
                    contents: chunk
                });
            }

            offset += bytesRead;
            const progress = Math.round((offset / fileSize) * 100);
            this.log('info', `Upload-Fortschritt: ${progress}%`);
        }
        fs.closeSync(fd);
    }

    // Hilfsmethode für sicheres Logging im ioBroker-Kontext
    log(level, message) {
        if (this.adapter && this.adapter.log && typeof this.adapter.log[level] === 'function') {
            this.adapter.log[level](message);
        } else {
            console[level === 'info' ? 'log' : 'error'](message);
        }
    }
}

module.exports = Backup;

*/
