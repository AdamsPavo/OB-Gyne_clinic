# Backup and restore

Restart the backend after installing this update; its startup migration adds a small session-version record. Existing sessions continue working until a restore is completed.

Open **Backup & Restore** from the sidebar, or **Tools → Backup / Restore**.

- **Create backup** writes a consistent SQLite snapshot, including committed WAL data, to `server/storage/backups`. Partial files are never listed as completed backups.
- **Download** saves the selected .db file to your computer.
- **Import .db file** validates a clinic backup and adds it to the server's list. The upload limit is 100 MB. Import does not replace any current records.
- **Restore** first displays the backup's record counts. Enter its exact filename to confirm. The application verifies integrity, database structure, foreign keys, and the presence of an active Admin account.
- **Delete** removes only the selected backup file, following confirmation.

A restore creates a `before-restore-...db` recovery snapshot before changing records. All application tables are restored in a single SQLite transaction with existing audit/default triggers temporarily suspended and reinstated. If restoration fails, the transaction rolls back. The recovery file remains available in the list.

The backend blocks new API requests during restoration and asks you to retry if another request is already running. After success, existing login tokens are invalidated, including tokens issued before earlier restores. Sign in using credentials saved in the selected backup. The server remains running; no restart is needed after a successful restore.

Users with Backups/View can see the list; Backups/Create allows creating server-side snapshots. Only Admin may download, import, delete, or restore full databases, because these files include account credentials, permissions, and clinical records.

Only compatible clinic SQLite backups are accepted. Backups made immediately before the permissions update can omit the users.permissions column; it is filled with legacy defaults. Backups with other missing tables or incompatible columns are rejected. No automatic schema downgrade is performed.

Keep an exported copy on separate secure storage. Backups on the same disk do not protect against disk failure. Stored snapshot files are excluded from Git.

Tests run against temporary databases and do not restore or modify the live clinic database:

```powershell
node --test server/tests/backups.test.js
```
