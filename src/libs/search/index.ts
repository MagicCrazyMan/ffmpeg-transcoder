export type SearchEntry = SearchDirectory | SearchFile;

export type SearchDirectory = {
  type: "Directory";
  absolute: string;
  relative: string;
  name?: string;
  children: SearchEntry[];
};

export type SearchFile = {
  type: "File";
  absolute: string;
  relative: string;
  name: string;
  stem?: string;
  extension?: string;
};
