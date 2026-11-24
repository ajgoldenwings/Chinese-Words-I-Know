// Minimal Node typings for tests that read project files. The project does not depend on @types/node.
declare module 'node:fs' {
  export interface FileBuffer {
    readUInt16LE(offset: number): number;
    readUInt32BE(offset: number): number;
    [index: number]: number;
  }
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): FileBuffer;
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
declare const process: { cwd(): string };
