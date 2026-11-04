import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Splash } from "./Splash";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Splash />
    <App />
  </React.StrictMode>,
);
