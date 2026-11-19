import { createRoot } from "react-dom/client";
import "../../src/index.css";
import NativeSignedOutEntry from "../../src/components/NativeSignedOutEntry";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Native signed-out entry fixture root was not found.");
}

createRoot(root).render(
  <main>
    <NativeSignedOutEntry supportEmail="support@marathonerapp.com" />
  </main>,
);
