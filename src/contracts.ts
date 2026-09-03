export const bbApp = {
  name: "abrum.buchhaltungsbutler",
  entities: {},
  functions: {
    testConnection: { name: "testConnection" },
    listReceipts: { name: "listReceipts" },
    downloadReceipt: { name: "downloadReceipt" },
    uploadReceipt: { name: "uploadReceipt" },
    listTransactions: { name: "listTransactions" },
    listPostings: { name: "listPostings" },
    listAccounts: { name: "listAccounts" },
    listDebtors: { name: "listDebtors" },
    listCreditors: { name: "listCreditors" },
    listPostingAccounts: { name: "listPostingAccounts" },
    listCostLocations: { name: "listCostLocations" },
  },
  surfaces: { main: { name: "main" } },
} as const;

export const secretsImport = {
  name: "abrum.secrets",
  entities: {},
  functions: { listSecrets: { name: "listSecrets" } },
  surfaces: {
    main: { name: "main" },
    credentialConnection: { name: "credential-connection" },
  },
} as const;

export const CREDENTIAL_SECRET_ID = "buchhaltungsbutler.credentials";
