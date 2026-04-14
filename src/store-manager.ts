import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;
  title: string;
  type: "text" | "checklist";
  content?: string;
  items?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export class StorageManager {
  private filePath: string;
  private ready: Promise<void>;

  constructor(storageUri: vscode.Uri) {
    this.filePath = path.join(storageUri.fsPath, "tote.json");
    this.ready = fs
      .mkdir(storageUri.fsPath, { recursive: true })
      .then(() => undefined);
  }

  async load(): Promise<Note[]> {
    await this.ready;
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      if (err.code === "ENOENT") return [];
      vscode.window.showErrorMessage(
        `Tote: Failed to load notes — ${err.message}`,
      );
      return [];
    }
  }

  async save(notes: Note[]): Promise<void> {
    await this.ready;
    try {
      await fs.writeFile(
        this.filePath,
        JSON.stringify(notes, null, 2),
        "utf-8",
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Tote: Failed to save notes — ${err.message}`,
      );
    }
  }

  async addNote(
    notes: Note[],
    partial: Omit<Note, "id" | "createdAt" | "updatedAt">,
  ): Promise<{ notes: Note[]; id: string }> {
    const now = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const note: Note = { ...partial, id, createdAt: now, updatedAt: now };
    const updated = [...notes, note];
    await this.save(updated);
    return { notes: updated, id };
  }

  async updateNote(
    notes: Note[],
    id: string,
    changes: Partial<Note>,
  ): Promise<Note[]> {
    const updated = notes.map((n) =>
      n.id === id
        ? { ...n, ...changes, updatedAt: new Date().toISOString() }
        : n,
    );
    await this.save(updated);
    return updated;
  }

  async deleteNote(notes: Note[], id: string): Promise<Note[]> {
    const updated = notes.filter((n) => n.id !== id);
    await this.save(updated);
    return updated;
  }

  get storageLocation(): string {
    return this.filePath;
  }
}
