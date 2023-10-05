import { invoke } from "@tauri-apps/api";
import { TaskParams } from "../store/task";

export const startTask = async (id: string, params: TaskParams) => {
  return await invoke<void>("start_task", { id, params });
};

export const stopTask = async (id: string) => {
  return await invoke<void>("stop_task", { id });
};

export const pauseTask = async (id: string) => {
  return await invoke<void>("pause_task", { id });
};

export const resumeTask = async (id: string) => {
  return await invoke<void>("resume_task", { id });
};

export type Metadata = {
  streams: Stream[];
  chapters: Chapter[];
  format: Format;
};

export type Format = {
  filename: string;
  nb_streams: number;
  nb_programs: number;
  format_name: string;
  format_long_name: string;
  start_time: string;
  duration: string;
  size: string;
  bit_rate: string;
  probe_score: number;
  tags: {
    major_brand: string;
    minor_version: string;
    compatible_brands: string;
    encoder: string;
  };
};

export type Stream = {
  index: number;
  codec_name: string;
  codec_long_name: string;
  profile?: string;
  codec_type: string;
  codec_tag_string: string;
  codec_tag: string;
  width?: number;
  height?: number;
  coded_width?: number;
  coded_height?: number;
  closed_captions?: number;
  film_grain?: number;
  has_b_frames?: number;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  pix_fmt?: string;
  level?: number;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  chroma_location?: string;
  field_order?: string;
  refs?: number;
  is_avc?: string;
  nal_length_size?: string;
  id: string;
  r_frame_rate: string;
  avg_frame_rate: string;
  time_base: string;
  start_pts: number;
  start_time: string;
  duration_ts: number;
  duration: string;
  bit_rate: string;
  bits_per_raw_sample: string;
  extradata_size: number;
  disposition: {
    default: 0 | 1;
    dub: 0 | 1;
    original: 0 | 1;
    comment: 0 | 1;
    lyrics: 0 | 1;
    karaoke: 0 | 1;
    forced: 0 | 1;
    hearing_impaired: 0 | 1;
    visual_impaired: 0 | 1;
    clean_effects: 0 | 1;
    attached_pic: 0 | 1;
    timed_thumbnails: 0 | 1;
    captions: 0 | 1;
    descriptions: 0 | 1;
    metadata: 0 | 1;
    dependent: 0 | 1;
    still_image: 0 | 1;
  };
  tags: {
    language: string;
    handler_name: string;
    vendor_id: string;
  };
  sample_fmt?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_sample?: number;
  initial_padding?: number;
};

export type Chapter = {
  //
};

export const getMediaMetadata = async (path: string) => {
  return await invoke<string>("media_metadata", { path }).then(
    (metadataRaw) => JSON.parse(metadataRaw) as Metadata
  );
};
