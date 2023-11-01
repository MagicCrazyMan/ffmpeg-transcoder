export type SystemParticulars = {
  path_separator: string;
  ffmpeg: FFmpegParticulars;
};

export type FFmpegParticulars = {
  banner: FFmpegBanner;
  codecs: FFmpegCodec[];
  hwaccels: string[];
};

export type FFmpegBanner = {
  version?: string;
  copyright?: string;
  compiler?: string;
  build_configurations: string[];
  libraries: Record<string, number[]>;
};

export enum FFmpegCodecType {
  Video = 0,
  Audio = 1,
  Subtitle = 2,
  Data = 3,
  Attachment = 4,
}

export type FFmpegCodec = {
  name: string;
  description: string;
  type: FFmpegCodecType;
  decode: boolean;
  encode: boolean;
  intra: boolean;
  lossy: boolean;
  lossless: boolean;
  decoders: string[];
  encoders: string[];
};
