function format(level: string, tag: string, message: string): string {
  return `[${new Date().toISOString()}] [${level}] [${tag}] ${message}`;
}

export const logger = {
  info(tag: string, message: string, ...args: unknown[]) {
    console.log(format("INFO", tag, message), ...args);
  },
  error(tag: string, message: string, ...args: unknown[]) {
    console.error(format("ERROR", tag, message), ...args);
  },
};
