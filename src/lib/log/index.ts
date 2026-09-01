type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (msg: string, fields?: LogFields) => void;
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields, err?: unknown) => void;
  child: (fields: LogFields) => Logger;
};

function resolveLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function serializeError(err: unknown): LogFields | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: String(err) };
}

function emit(
  level: LogLevel,
  component: string,
  msg: string,
  bound: LogFields,
  fields?: LogFields,
  err?: unknown,
) {
  const minLevel = resolveLevel();
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

  const payload: LogFields = {
    ts: new Date().toISOString(),
    level,
    component,
    msg,
    ...bound,
    ...fields,
    ...serializeError(err),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(component: string, bound: LogFields = {}): Logger {
  return {
    debug: (msg, fields) => emit("debug", component, msg, bound, fields),
    info: (msg, fields) => emit("info", component, msg, bound, fields),
    warn: (msg, fields) => emit("warn", component, msg, bound, fields),
    error: (msg, fields, err) => emit("error", component, msg, bound, fields, err),
    child: (fields) => createLogger(component, { ...bound, ...fields }),
  };
}
