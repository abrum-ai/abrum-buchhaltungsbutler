import manifest from "../abrum.app.json";
import { App } from "./App";
import { mountAbrumApp } from "@abrum/react";
import "@abrum/react/theme.css";
import "./styles.css";

mountAbrumApp({
  app: <App />,
  appId: manifest.appId,
  install: manifest as never,
});
