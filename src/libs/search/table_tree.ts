import { SearchDirectory, SearchFile } from ".";

export type SearchEntryNode = SearchDirectoryNode | SearchFileNode;

export type SearchDirectoryNode = Omit<SearchDirectory, "children"> & {
  children: SearchEntryNode[];
  parent: SearchDirectoryNode | null;
};

export type SearchFileNode = SearchFile & {
  parent: SearchDirectoryNode;
};
