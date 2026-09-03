import React from "react";
import {
  AbrumAppShell,
  useAbrumActions,
  useAbrumAppSurface,
  useAbrumGlobalNavigation,
} from "@abrum/react";
import {
  AppIcon,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@abrum/react/ui";
import { bbApp, CREDENTIAL_SECRET_ID, secretsImport } from "./contracts";

type RunResult = { data?: unknown };
type SectionId = "receipts" | "transactions" | "postings" | "accounts" | "master-data";
type MasterDataset = "debtors" | "creditors" | "posting-accounts" | "cost-locations";

const NAVIGATION = [
  { id: "receipts", label: "Belege", icon: "inbox" },
  { id: "transactions", label: "Transaktionen", icon: "route" },
  { id: "postings", label: "Buchungen", icon: "book" },
  { id: "accounts", label: "Konten", icon: "database" },
  { id: "master-data", label: "Stammdaten", icon: "users" },
] as const;
const GLOBAL_NAVIGATION = NAVIGATION.map((item) => ({ ...item }));

const SECTIONS: Record<SectionId, { title: string; description: string }> = {
  receipts: { title: "Belege", description: "Eingangs- und Ausgangsbelege verwalten" },
  transactions: { title: "Transaktionen", description: "Kontobewegungen aus BuchhaltungsButler" },
  postings: { title: "Buchungen", description: "Buchungssätze und Kontierungen prüfen" },
  accounts: { title: "Konten", description: "Verbundene Bank- und Buchhaltungskonten" },
  "master-data": { title: "Stammdaten", description: "Kontakte, Sachkonten und Kostenstellen" },
};

const MASTER_DATASETS: Record<MasterDataset, { label: string; action: string }> = {
  debtors: { label: "Debitoren", action: "listDebtors" },
  creditors: { label: "Kreditoren", action: "listCreditors" },
  "posting-accounts": { label: "Sachkonten", action: "listPostingAccounts" },
  "cost-locations": { label: "Kostenstellen", action: "listCostLocations" },
};

function resultData(result: unknown): unknown {
  return result && typeof result === "object" && "data" in result
    ? (result as RunResult).data
    : result;
}

function arrayFromResult(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of [
    "data",
    "receipts",
    "transactions",
    "postings",
    "accounts",
    "debtors",
    "creditors",
    "posting_accounts",
    "cost_locations",
    "result",
  ]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  return [];
}

function valueFrom(record: Record<string, unknown>, keys: string[], fallback = "—"): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return fallback;
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
  const [connectionStatus, setConnectionStatus] = React.useState("Nicht geprüft");
  const [activeSection, setActiveSection] = React.useState<SectionId>("receipts");
  const [masterDataset, setMasterDataset] = React.useState<MasterDataset>("debtors");
  const [rows, setRows] = React.useState<unknown[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [direction, setDirection] = React.useState("inbound");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectSection = React.useCallback((section: string) => {
    if (!NAVIGATION.some((item) => item.id === section)) return;
    setActiveSection(section as SectionId);
    setRows([]);
    setError("");
    setNotice("");
  }, []);

  const hostOwnsNavigation = useAbrumGlobalNavigation({
    items: GLOBAL_NAVIGATION,
    activeItemId: activeSection,
    onSelect: selectSection,
  });

  const loadRows = React.useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = resultData(await action());
      setRows(arrayFromResult(data));
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const loadActiveSection = React.useCallback(async () => {
    if (activeSection === "receipts") {
      await loadRows(() => actions.listReceipts({
        payload: { list_direction: direction, limit: 100, offset: 0 },
      }));
      return;
    }
    if (activeSection === "transactions") {
      await loadRows(() => actions.listTransactions({ payload: { limit: 100, offset: 0 } }));
      return;
    }
    if (activeSection === "postings") {
      await loadRows(() => actions.listPostings({ payload: { limit: 100, offset: 0 } }));
      return;
    }
    if (activeSection === "accounts") {
      await loadRows(() => actions.listAccounts({}));
      return;
    }
    const action = actions[MASTER_DATASETS[masterDataset].action];
    await loadRows(() => action({ payload: { limit: 100, offset: 0 } }));
  }, [actions, activeSection, direction, loadRows, masterDataset]);

  const connect = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
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
        setConnectionStatus("Zugang gespeichert");
        setNotice("Der Zugang wurde in Secrets gespeichert. Prüfe jetzt die Verbindung.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [openSecrets]);

  const testConnection = React.useCallback(async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await actions.testConnection({});
      setConnectionStatus("Verbunden");
      setNotice("BuchhaltungsButler ist erreichbar.");
    } catch (cause) {
      setConnectionStatus("Fehlgeschlagen");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [actions]);

  const upload = React.useCallback(async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setError("Dateien sind auf 25 MiB begrenzt.");
      return;
    }
    let fileBase64: string;
    try {
      fileBase64 = await fileToBase64(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    const uploaded = await loadRows(() => actions.uploadReceipt({
      artifactRef: "ui-upload",
      fileBase64,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      receiptType: direction === "outbound" ? "invoice outbound" : "invoice inbound",
    }));
    if (uploaded) setNotice(`${file.name} wurde an BuchhaltungsButler übertragen.`);
  }, [actions, direction, loadRows]);

  const section = SECTIONS[activeSection];
  const connectionTone: "success" | "danger" | "neutral" = connectionStatus === "Verbunden"
    ? "success"
    : connectionStatus === "Fehlgeschlagen"
      ? "danger"
      : "neutral";

  return (
    <AbrumAppShell appName="BuchhaltungsButler" appIcon={<AppIcon icon="receipt" size={18} />}>
      <main className="bb-page" data-abrum-density="comfortable">
        {!hostOwnsNavigation ? (
          <Tabs className="bb-local-navigation" value={activeSection} onValueChange={selectSection}>
            <TabsList aria-label="Buchhaltungsbereiche">
              {NAVIGATION.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        <div className="bb-content">
          <header className="bb-titlebar">
            <div className="bb-titlecopy">
              <p className="bb-kicker">BUCHHALTUNGSBUTLER</p>
              <h1>{section.title}</h1>
              <p>{section.description}</p>
            </div>
            <div className="bb-connection" aria-label="Provider-Verbindung">
              <Badge tone={connectionTone}>{connectionStatus}</Badge>
              <Button variant="ghost" onClick={() => void testConnection()} disabled={busy}>
                Verbindung prüfen
              </Button>
              <Button variant="secondary" onClick={() => void connect()} disabled={busy}>
                Zugang
              </Button>
            </div>
          </header>

          <section className="bb-toolbar" aria-label="Filter und Aktionen">
            <div className="bb-filters">
              {activeSection === "receipts" ? (
                <Select
                  aria-label="Belegfluss"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value)}
                >
                  <option value="inbound">Eingangsbelege</option>
                  <option value="outbound">Ausgangsbelege</option>
                </Select>
              ) : null}
              {activeSection === "master-data" ? (
                <Select
                  aria-label="Stammdatentyp"
                  value={masterDataset}
                  onChange={(event) => setMasterDataset(event.target.value as MasterDataset)}
                >
                  {Object.entries(MASTER_DATASETS).map(([id, dataset]) => (
                    <option key={id} value={id}>{dataset.label}</option>
                  ))}
                </Select>
              ) : null}
            </div>
            <div className="bb-actions">
              <Button variant="secondary" onClick={() => void loadActiveSection()} disabled={busy}>
                {busy ? "Lädt …" : "Aktualisieren"}
              </Button>
              {activeSection === "receipts" ? (
                <>
                  <input
                    ref={fileInputRef}
                    className="bb-file-input"
                    type="file"
                    accept=".pdf,.xml,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    Datei hochladen
                  </Button>
                </>
              ) : null}
            </div>
          </section>

          {error ? <div className="bb-alert bb-alert-error" role="alert">{error}</div> : null}
          {notice ? <div className="bb-alert bb-alert-success" role="status">{notice}</div> : null}

          <Card className="bb-data-card">
            <CardHeader className="bb-data-heading">
              <div>
                <h2>{section.title}</h2>
                <p>{activeSection === "master-data" ? MASTER_DATASETS[masterDataset].label : section.description}</p>
              </div>
              <span>{busy ? "Lädt …" : `${rows.length} Einträge`}</span>
            </CardHeader>
            <CardContent className="bb-data-content">
              {rows.length ? (
                <div className="bb-table-wrap">
                  <table>
                    <thead><tr><th>Nr.</th><th>Datum / Name</th><th>Status / Typ</th><th>Betrag / Konto</th></tr></thead>
                    <tbody>
                      {rows.map((row, index) => {
                        const record = row && typeof row === "object"
                          ? row as Record<string, unknown>
                          : { value: row };
                        const id = valueFrom(record, ["id_by_customer", "id"], String(index + 1));
                        return (
                          <tr key={`${id}-${index}`}>
                            <td>{id}</td>
                            <td>
                              <strong>{valueFrom(record, ["counterparty", "name", "to_from", "value"])}</strong>
                              <small>{valueFrom(record, ["date", "booking_date"], "")}</small>
                            </td>
                            <td>{valueFrom(record, ["status", "type", "payment_status"])}</td>
                            <td>{valueFrom(record, ["amount", "account", "account_number"])}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bb-empty">
                  <AppIcon icon="receipt" size={24} />
                  <h3>Noch keine Daten geladen</h3>
                  <p>Prüfe die Verbindung und rufe anschließend die aktuelle Ansicht ab.</p>
                  <Button variant="secondary" onClick={() => void loadActiveSection()} disabled={busy}>
                    Daten laden
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </AbrumAppShell>
  );
}
