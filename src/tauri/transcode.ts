export type TranscodeItem = {
  inputs: InputParams[];
  outputs: OutputParams[];
};

export type InputParams = {
  path: string;
  params: string[];
};

export type OutputParams = {
  path: string;
  params: string[];
};

export const transcode = () => {};
