import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { metaMessengerPlugin } from "./src/channel.js";
import { setMetaMessengerRuntime } from "./src/runtime.js";

export { metaMessengerPlugin } from "./src/channel.js";
export { setMetaMessengerRuntime } from "./src/runtime.js";

export default defineChannelPluginEntry({
  id: "meta-messenger",
  name: "Meta Messenger / Instagram",
  description: "Facebook Messenger and Instagram DMs via Meta Graph API webhook",
  plugin: metaMessengerPlugin,
  setRuntime: setMetaMessengerRuntime,
});
