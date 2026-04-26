/**
 * Browser File System Access API helpers.
 * Lets the user grant R2D2 read/write access to a folder on their machine,
 * which it can then operate on inside the tab session.
 */

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (opts?: any) => Promise<FileSystemFileHandle[]>;
  }
}

export type GrantedFolder = {
  name: string;
  handle: FileSystemDirectoryHandle;
  grantedAt: number;
};

const _granted: GrantedFolder[] = [];

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

export async function grantFolder(): Promise<GrantedFolder | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      "File System Access API not supported. Use Chrome or Edge on desktop.",
    );
  }
  const handle = await window.showDirectoryPicker!({ mode: "readwrite" });
  const folder: GrantedFolder = {
    name: handle.name,
    handle,
    grantedAt: Date.now(),
  };
  _granted.unshift(folder);
  return folder;
}

export function listGrantedFolders(): GrantedFolder[] {
  return [..._granted];
}

export async function listFiles(
  handle: FileSystemDirectoryHandle,
): Promise<{ name: string; kind: "file" | "directory" }[]> {
  const out: { name: string; kind: "file" | "directory" }[] = [];
  const anyHandle = handle as unknown as { values: () => AsyncIterable<{ name: string; kind: "file" | "directory" }> };
  for await (const entry of anyHandle.values()) {
    out.push({ name: entry.name, kind: entry.kind });
  }
  return out.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1,
  );
}

export async function readTextFile(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<string> {
  const fh = await dir.getFileHandle(name);
  const f = await fh.getFile();
  return f.text();
}

export async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  content: string,
): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const anyFh = fh as unknown as { createWritable: () => Promise<{ write: (c: string) => Promise<void>; close: () => Promise<void> }> };
  const w = await anyFh.createWritable();
  await w.write(content);
  await w.close();
}
