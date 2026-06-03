import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";

const hostname = window.location.hostname;
const isNoemail = hostname === "noemail.noehost.com" || hostname.startsWith("noemail.");

if (isNoemail) {
  import("./noemail/NoeMailApp").then(({ default: NoeMailApp }) => {
    createRoot(document.getElementById("root")!).render(
      <ErrorBoundary>
        <NoeMailApp />
      </ErrorBoundary>
    );
  });
} else {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
