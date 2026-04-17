import { defineSetupPluginEntry } from "openclaw/plugin-sdk/core";
import { metaMessengerSetupWizard } from "./src/setup-surface.js";

export { metaMessengerSetupWizard } from "./src/setup-surface.js";

export default defineSetupPluginEntry({ plugin: metaMessengerSetupWizard });
