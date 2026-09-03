# BuchhaltungsButler for ABRUM

Eine eigenständige ABRUM App für die BuchhaltungsButler API. Sie läuft direkt als `station-js`-Backend, importiert `abrum.secrets` für die Provider-Verbindung und unterstützt Run-Artefakte für Beleg-Upload und -Download.

## In ABRUM installieren

In „Neue App / Room“ den Bereich **App from URL** öffnen und diese öffentliche URL verwenden:

```text
https://github.com/abrum-ai/abrum-buchhaltungsbutler
```

ABRUM klont das Repo, installiert die npm-Abhängigkeiten, baut das Web-Bundle und dockt Web- und `station-js`-Artefakte in den neuen Provider Room. Der Secrets-Begleiter wird automatisch mitinstalliert.

## Verbindung

„Zugang verwalten“ öffnet die importierte Secrets-Oberfläche. Der Wert des Secrets `buchhaltungsbutler.credentials` ist ein JSON-Objekt:

```json
{
  "apiClient": "...",
  "apiSecret": "...",
  "apiKey": "..."
}
```

Der Klartext wird von der Station erst serverseitig in den Funktionsaufruf eingesetzt. App-Oberfläche und Agent erhalten ihn nicht zurück.

## Dateien

- Upload: Die UI kann PDF, XML und Bilder bis 25 MiB auswählen. Im Agent-Pfad wird ausschließlich ein Run-gebundenes `artifactRef` übergeben; die Station setzt die Bytes privat ein.
- Download: `downloadReceipt` liefert eine markierte Datei. Die Station entfernt Base64 vor dem Agent-Transcript, legt einen unveränderlichen Blob an und gibt ein neues `artifactRef` zurück. Mit `files_save_artifact` kann es in einen ausdrücklich freigegebenen Ordner geschrieben werden.

## Entwicklung

```bash
npm install
npm test
npm run build
```

Die API-Formen orientieren sich am MIT-lizenzierten Referenzprojekt [ohneben/Buchhaltungsbutler-MCP](https://github.com/ohneben/Buchhaltungsbutler-MCP). Die App übernimmt keine Zugangsdaten oder Laufzeitkomponenten daraus.
