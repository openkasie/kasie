import { toPipedreamAppSlug } from "./app-slug";

const PIPEDREAM_CONNECT_IFRAME_URL = "https://pipedream.com/_static/connect.html";

export type PipedreamConnectMessage =
  | { type: "success"; authProvisionId: string }
  | { type: "error"; error?: string }
  | { type: "close" };

export function buildConnectIframeUrl(input: {
  token: string;
  appSlug: string;
  hideClose?: boolean;
}) {
  const qp = new URLSearchParams({ token: input.token, app: toPipedreamAppSlug(input.appSlug) });
  if (input.hideClose) qp.set("hideClose", "true");
  return `${PIPEDREAM_CONNECT_IFRAME_URL}?${qp.toString()}`;
}

export function isPipedreamConnectMessage(data: unknown): data is PipedreamConnectMessage {
  if (!data || typeof data !== "object") return false;
  const type = (data as { type?: unknown }).type;
  return type === "success" || type === "error" || type === "close";
}
