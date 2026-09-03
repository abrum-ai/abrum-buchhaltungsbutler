import React from "react";
import { AbrumAppShell, useAbrumActions, useAbrumAppSurface } from "@abrum/react";
import { bbApp, CREDENTIAL_SECRET_ID, secretsImport } from "./contracts";

type RunResult = { data?: unknown };

function resultData(result: unknown): unknown {
  return result && typeof result === "object" && "data" in result
    ? (result as RunResult).data
    : result;
}

function arrayFromResult(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["data", "receipts", "transactions", "postings", "accounts", "result"]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  return [];
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function App() {
  const actions = useAbrumActions(bbApp as never) as Record<string, (input?: unknown) => Promise<unknown>>;
  const openSecrets = useAbrumAppSurface(secretsImport as never) as unknown as (
    surface: string,
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  const [status, setStatus] = React.useState("Noch nicht geprüft");
  const [rows, setRows] = React.useState<unknown[]>([]);
  const [view, setView] = React.useState("Belege");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [direction, setDirection] = React.useState("inbound");

  const run = React.useCallback(async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      const data = resultData(result);
      setRows(arrayFromResult(data));
      setView(label);
      return data;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  async function connect() {
    const result = await openSecrets("credentialConnection", {
      requiredByAppId: "abrum.buchhaltungsbutler",
      secretId: CREDENTIAL_SECRET_ID,
      username: "BuchhaltungsButler API",
    }, {
      title: "BuchhaltungsButler verbinden",
      width: 520,
      height: 460,
    });
    if (result && typeof result === "object" && (result as { status?: string }).status === "saved") {
      setStatus("Zugang gespeichert – Verbindung noch nicht geprüft");
    }
  }

  async function testConnection() {
    setBusy(true);
    setError("");
    try {
      await actions.testConnection({});
      setStatus("Verbunden");
    } catch (cause) {
      setStatus("Verbindung fehlgeschlagen");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (file.size > 25 * 1024 * 1024) throw new Error("Dateien sind auf 25 MiB begrenzt.");
    const fileBase64 = await fileToBase64(file);
    await run("Upload", () => actions.uploadReceipt({
      artifactRef: "ui-upload",
      fileBase64,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      receiptType: "invoice inbound",
    }));
  }

  return (
    <AbrumAppShell appName="BuchhaltungsButler">
      <main className="bb-shell">
        <header className="bb-header">
          <div>
            <h1>BuchhaltungsButler</h1>
            <p className="lede">Belege, Transaktionen und Konten laufen direkt über die Station. Zugangsdaten bleiben versiegelt in Secrets.</p>
          </div>
          <div className="connection-card">
            <span className={status === "Verbunden" ? "status-dot online" : "status-dot"} />
            <div><small>Verbindung</small><strong>{status}</strong></div>
            <button onClick={() => void connect()} disabled={busy}>Zugang verwalten</button>
            <button className="secondary" onClick={() => void testConnection()} disabled={busy}>Prüfen</button>
          </div>
        </header>

        <section className="toolbar" aria-label="Buchhaltungsbereiche">
          <button onClick={() => void run("Belege", () => actions.listReceipts({ payload: { list_direction: direction, limit: 100, offset: 0 } }))} disabled={busy}>Belege</button>
          <button onClick={() => void run("Transaktionen", () => actions.listTransactions({ payload: { limit: 100, offset: 0 } }))} disabled={busy}>Transaktionen</button>
          <button onClick={() => void run("Konten", () => actions.listAccounts({}))} disabled={busy}>Konten</button>
          <button onClick={() => void run("Kostenstellen", () => actions.listCostLocations({ payload: { limit: 100, offset: 0 } }))} disabled={busy}>Kostenstellen</button>
          <label className="direction">Belegfluss<select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="inbound">Eingang</option><option value="outbound">Ausgang</option></select></label>
          <label className="upload">Datei hochladen<input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png,.bmp,.tif,.tiff" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /></label>
        </section>

        {error ? <div className="error" role="alert">{error}</div> : null}

        <section className="data-card">
          <div className="data-heading"><div><p className="eyebrow">AKTUELLE SICHT</p><h2>{view}</h2></div><span>{busy ? "Lädt …" : `${rows.length} Einträge`}</span></div>
          {rows.length ? (
            <div className="table-wrap"><table><thead><tr><th>Nr.</th><th>Datum / Name</th><th>Status / Typ</th><th>Betrag / Konto</th></tr></thead><tbody>{rows.map((row, index) => { const record = row && typeof row === "object" ? row as Record<string, unknown> : { value: row }; return <tr key={String(record.id_by_customer ?? record.id ?? index)}><td>{String(record.id_by_customer ?? record.id ?? index + 1)}</td><td><strong>{String(record.counterparty ?? record.name ?? record.to_from ?? "—")}</strong><small>{String(record.date ?? record.booking_date ?? "")}</small></td><td>{String(record.status ?? record.type ?? record.payment_status ?? "—")}</td><td>{String(record.amount ?? record.account ?? "—")}</td></tr>; })}</tbody></table></div>
          ) : <div className="empty"><span>BB</span><h3>Noch keine Daten geladen</h3><p>Verbindung prüfen und oben einen Bereich öffnen.</p></div>}
        </section>
      </main>
    </AbrumAppShell>
  );
}
