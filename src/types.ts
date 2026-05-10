export type RedactStrategy = "empty" | "placeholder";

export type EnvxConfig = {
  descriptions?: Record<string, string>;
  required?: string[];
  examples?: Record<string, string>;
  keepValues?: string[];
  redactStrategy?: RedactStrategy;
};

export type GateResult = {
  ok: boolean;
  exitCode: number;
  message: string;
};
