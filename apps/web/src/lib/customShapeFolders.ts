/*
 * The tree of custom shape folders, the same for both sides: in the browser
 * each folder names its parent, on the server the tree is the folders inside
 * "Custom shapes". Folders go three levels deep; a folder on the third level
 * takes shapes but no further folders.
 */

export const CUSTOM_SHAPE_FOLDER_DEPTH = 3;

/** Paths of server folders are joined with this; folder names cannot hold a slash. */
export const FOLDER_PATH_SEPARATOR = "/";

export type FolderNode = { id: string; name: string; parentId: string | null };

/** The folders right inside `parentId` (null: at the top), by name. */
export function folderChildren<T extends FolderNode>(folders: readonly T[], parentId: string | null): T[] {
  return folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
}

/** The folder and the ones above it, from the top down; empty for an unknown id. A loop in broken data ends the walk. */
export function folderAncestry<T extends FolderNode>(folders: readonly T[], id: string | null): T[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: T[] = [];
  let current = id ? byId.get(id) : undefined;
  while (current && !chain.includes(current)) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** 1 for a folder at the top, 0 for no folder. */
export function folderDepth(folders: readonly FolderNode[], id: string | null) {
  return folderAncestry(folders, id).length;
}

/** Whether a new folder can go into `parentId` (null: at the top). */
export function canHoldSubfolder(folders: readonly FolderNode[], parentId: string | null) {
  return folderDepth(folders, parentId) < CUSTOM_SHAPE_FOLDER_DEPTH;
}

/** The folder and every folder below it. */
export function folderDescendantIds(folders: readonly FolderNode[], id: string): string[] {
  const found = [id];
  for (let index = 0; index < found.length; index += 1) {
    for (const folder of folders) {
      if (folder.parentId === found[index] && !found.includes(folder.id)) found.push(folder.id);
    }
  }
  return found;
}

/** "Brackets / M3", as the folder lists show where a folder sits. */
export function folderLabel(folders: readonly FolderNode[], id: string) {
  return folderAncestry(folders, id).map((folder) => folder.name).join(" / ");
}

/** Every folder in the order of the tree, top folders first and each one followed by the folders inside it. */
export function foldersInTreeOrder<T extends FolderNode>(folders: readonly T[]): T[] {
  const ordered: T[] = [];
  const visit = (parentId: string | null) => {
    for (const folder of folderChildren(folders, parentId)) {
      if (ordered.includes(folder)) continue;
      ordered.push(folder);
      visit(folder.id);
    }
  };
  visit(null);
  return ordered;
}

/** The parent of a server folder path ("A/B" -> "A"), null at the top. */
export function parentFolderPath(path: string) {
  const cut = path.lastIndexOf(FOLDER_PATH_SEPARATOR);
  return cut < 0 ? null : path.slice(0, cut);
}

/** The last name of a server folder path. */
export function folderPathName(path: string) {
  return path.slice(path.lastIndexOf(FOLDER_PATH_SEPARATOR) + 1);
}

export function joinFolderPath(parent: string | null, name: string) {
  return parent ? `${parent}${FOLDER_PATH_SEPARATOR}${name}` : name;
}
