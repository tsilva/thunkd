import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useSyncExternalStore } from "react";
import { sendEmail } from "./gmail";

const KEEP_AWAKE_TAG = "email-queue";
const RETRY_DELAY_MS = 1000;

type QueueItem = { text: string; userEmail: string };
export type SentItem = {
  id: string;
  text: string;
  sentAt: number;
};
type Listener = () => void;

let queue: QueueItem[] = [];
let sentHistory: SentItem[] = [];
let processing = false;
let listeners: Listener[] = [];
let errorHandler: ((msg: string) => void) | null = null;

function notify() {
  for (const l of listeners) l();
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue[0];
    let ok = false;

    try {
      await sendEmail(item.text, item.userEmail);
      ok = true;
    } catch {
      // Retry once after delay
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        await sendEmail(item.text, item.userEmail);
        ok = true;
      } catch (e: any) {
        errorHandler?.(e.message ?? "Failed to send");
      }
    }

    queue = queue.slice(1);
    if (ok) {
      sentHistory = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: item.text,
          sentAt: Date.now(),
        },
        ...sentHistory,
      ];
    }
    notify();
  }

  processing = false;
  deactivateKeepAwake(KEEP_AWAKE_TAG);
}

export function enqueue(text: string, userEmail: string) {
  queue = [...queue, { text, userEmail }];
  notify();
  activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
  processQueue();
}

export function setErrorHandler(fn: ((msg: string) => void) | null) {
  errorHandler = fn;
}

function subscribe(listener: Listener) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getPendingCount() {
  return queue.length;
}

function getSentHistory() {
  return sentHistory;
}

export function useEmailQueue() {
  const pendingCount = useSyncExternalStore(subscribe, getPendingCount);
  const sentItems = useSyncExternalStore(subscribe, getSentHistory);
  return { pendingCount, enqueue, sentItems };
}
