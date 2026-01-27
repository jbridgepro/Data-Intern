import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { PanelConfigurationProvider } from "./features/panel-configuration/contexts/PanelConfigurationContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PanelConfigurationProvider>
      <App />
    </PanelConfigurationProvider>
  </React.StrictMode>,
);
