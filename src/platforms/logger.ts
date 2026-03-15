export interface PlatformLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export const noopPlatformLogger: PlatformLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};
