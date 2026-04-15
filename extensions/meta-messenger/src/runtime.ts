import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";

const { setRuntime: setMetaMessengerRuntime, getRuntime: getMetaMessengerRuntime } =
  createPluginRuntimeStore<PluginRuntime>(
    "Meta Messenger runtime not initialized - plugin not registered",
  );

export { getMetaMessengerRuntime, setMetaMessengerRuntime };
