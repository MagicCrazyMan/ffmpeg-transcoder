use std::{collections::HashMap, path::PathBuf, sync::OnceLock};

use regex::Regex;

use crate::{
    handlers::{
        config::{AppConfig, Config},
        error::Error,
    },
    with_default_args,
};

use super::process::{invoke_ffmpeg, invoke_ffprobe};

#[tauri::command]
pub async fn verify_ffmpeg(ffmpeg: String) -> Result<(), Error> {
    let output = invoke_ffmpeg(&ffmpeg, with_default_args!("-version")).await?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim_start().starts_with("ffmpeg version") {
        Ok(())
    } else {
        Err(Error::ffmpeg_unavailable(ffmpeg))
    }
}

#[tauri::command]
pub async fn verify_ffprobe(ffprobe: String) -> Result<(), Error> {
    let output = invoke_ffprobe(&ffprobe, with_default_args!("-version")).await?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim_start().starts_with("ffprobe version") {
        Ok(())
    } else {
        Err(Error::ffprobe_unavailable(ffprobe))
    }
}

#[tauri::command]
pub async fn verify_directory(path: String) -> Result<(), Error> {
    if PathBuf::from(&path).is_dir() {
        Ok(())
    } else {
        Err(Error::directory_not_found(path))
    }
}

/// System basic information.
#[derive(Debug, serde::Serialize)]
pub struct SystemParticulars {
    ffmpeg: FFmpegParticulars,
}

/// FFmpeg situations.
#[derive(Debug, serde::Serialize)]
pub struct FFmpegParticulars {
    banner: FFmpegBanner,
    codecs: Vec<FFmpegCodec>,
}

/// FFmpeg banner information.
#[derive(Debug, serde::Serialize)]
pub struct FFmpegBanner {
    version: Option<String>,
    copyright: Option<String>,
    compiler: Option<String>,
    build_configurations: Vec<String>,
    libraries: HashMap<String, [usize; 6]>,
}

/// Codec types supported by FFmpeg.
#[derive(Debug, serde_repr::Serialize_repr)]
#[repr(u8)]
pub enum FFmpegCodecType {
    Video = 0,
    Audio = 1,
    Subtitle = 2,
    Data = 3,
    Attachment = 4,
}

/// Codec supported by FFmpeg.
#[derive(Debug, serde::Serialize)]
pub struct FFmpegCodec {
    name: String,
    description: String,
    decoders: Vec<String>,
    encoders: Vec<String>,
    r#type: FFmpegCodecType,
    decode: bool,
    encode: bool,
    intra: bool,
    lossy: bool,
    lossless: bool,
}

/// A command returns current system and ffmpeg particulars.
#[tauri::command]
pub async fn load_configuration(
    app_config: tauri::State<'_, AppConfig>,
    config: Config,
) -> Result<SystemParticulars, Error> {
    let ffmpeg = config.ffmpeg();
    let ffmpeg_banner = ffmpeg_banner(ffmpeg).await?;
    let ffmpeg_codecs = ffmpeg_codecs(ffmpeg).await?;
    let ffmpeg_particular = FFmpegParticulars {
        banner: ffmpeg_banner,
        codecs: ffmpeg_codecs,
    };

    let system_particulars = SystemParticulars {
        ffmpeg: ffmpeg_particular,
    };

    *app_config.lock().await = Some(config);

    Ok(system_particulars)
}

/// Extracts ffmpeg basic information from banner and wraps them into [`Banner`].
async fn ffmpeg_banner(ffmpeg: &str) -> Result<FFmpegBanner, Error> {
    static VERSION_AND_COPYRIGHT_EXTRACTOR: &'static str = r"^ffmpeg version (\S+) (.+)$";
    static COMPILER_EXTRACTOR: &'static str = r"^built with (.+)$";
    static CONFIGURATIONS_EXTRACTOR: &'static str = r"^configuration: (.+)$";
    static LIBS_EXTRACTOR: &'static str = r"^(.+) (.+)\.(.+)\.(.+) / (.+)\.(.+)\.(.+)$";

    static VERSION_AND_COPYRIGHT_REGEX: OnceLock<Regex> = OnceLock::new();
    static COMPILER_REGEX: OnceLock<Regex> = OnceLock::new();
    static CONFIGURATIONS_REGEX: OnceLock<Regex> = OnceLock::new();
    static LIBS_REGEX: OnceLock<Regex> = OnceLock::new();

    let output = invoke_ffmpeg(ffmpeg, with_default_args!("-version")).await?;

    let mut banner = FFmpegBanner {
        version: None,
        copyright: None,
        compiler: None,
        build_configurations: Vec::with_capacity(128),
        libraries: HashMap::with_capacity(8),
    };

    let version_and_copyright_regex = VERSION_AND_COPYRIGHT_REGEX
        .get_or_init(|| Regex::new(VERSION_AND_COPYRIGHT_EXTRACTOR).unwrap());
    let compilers_regex = COMPILER_REGEX.get_or_init(|| Regex::new(COMPILER_EXTRACTOR).unwrap());
    let configurations_regex =
        CONFIGURATIONS_REGEX.get_or_init(|| Regex::new(CONFIGURATIONS_EXTRACTOR).unwrap());
    let libs_regex = LIBS_REGEX.get_or_init(|| Regex::new(LIBS_EXTRACTOR).unwrap());
    for (i, line) in String::from_utf8_lossy(&output.stdout).lines().enumerate() {
        match i {
            0 => {
                // extract ffmpeg version and copyright
                let Some(caps) = version_and_copyright_regex.captures(&line) else {
                    continue;
                };

                banner.version = caps.get(1).map(|m| m.as_str().trim().to_string());
                banner.copyright = caps.get(2).map(|m| m.as_str().trim().to_string());
            }
            1 => {
                // extract built with info
                let Some(caps) = compilers_regex.captures(&line) else {
                    continue;
                };

                banner.compiler = caps.get(1).map(|m| m.as_str().trim().to_string());
            }
            2 => {
                // extract build configurations
                let Some(matched) = configurations_regex
                    .captures(&line)
                    .and_then(|caps| caps.get(1))
                else {
                    continue;
                };

                banner.build_configurations = matched
                    .as_str()
                    .split(" ")
                    .filter(|c| !c.is_empty())
                    .map(|c| c.trim())
                    .map(|c| c.to_string())
                    .collect();
            }
            _ => {
                // extract libraries
                let Some(caps) = libs_regex.captures(&line) else {
                    continue;
                };

                let (Some(name), Some(a), Some(b), Some(c), Some(d), Some(e), Some(f)) = (
                    caps.get(1).map(|m| m.as_str().trim().to_string()),
                    caps.get(2)
                        .and_then(|m| m.as_str().trim().parse::<usize>().ok()),
                    caps.get(3)
                        .and_then(|m| m.as_str().trim().parse::<usize>().ok()),
                    caps.get(4)
                        .and_then(|m| m.as_str().trim().parse::<usize>().ok()),
                    caps.get(5)
                        .and_then(|m| m.as_str().trim().parse::<usize>().ok()),
                    caps.get(6)
                        .and_then(|m| m.as_str().trim().parse::<usize>().ok()),
                    caps.get(7)
                        .and_then(|m| m.as_str().trim().parse::<usize>().ok()),
                ) else {
                    continue;
                };

                banner.libraries.insert(name, [a, b, c, d, e, f]);
            }
        };
    }

    Ok(banner)
}

// /// Formats supported by FFmpeg.
// #[derive(Debug, serde::Serialize)]
// pub struct Format {
//     name: String,
//     description: String,
//     demuxing: bool,
//     muxing: bool,
// }

// /// Extracts ffmpeg formats and wraps into [`Format`].
// async fn ffmpeg_formats(ffmpeg: &str) -> Result<Vec<Format>, Error> {
//     static FORMAT_EXTRACTOR: &'static str = r"^ (.{1})(.{1}) (\S+) (.+)$";
//     static FORMAT_REGEX: OnceLock<Regex> = OnceLock::new();

//     let output = invoke_ffmpeg(ffmpeg, with_default_args!("-formats")).await?;

//     let mut formats = Vec::with_capacity(128);
//     let format_regex = FORMAT_REGEX.get_or_init(|| Regex::new(FORMAT_EXTRACTOR).unwrap());
//     for line in String::from_utf8_lossy(&output.stdout).lines().skip(4) {
//         let Some(caps) = format_regex.captures(line) else {
//             continue;
//         };

//         let (Some(demuxing), Some(muxing), Some(name), Some(description)) = (
//             caps.get(1).map(|m| m.as_str() == "D"),
//             caps.get(2).map(|m| m.as_str() == "E"),
//             caps.get(3).map(|m| m.as_str().trim().to_string()),
//             caps.get(4).map(|m| m.as_str().trim().to_string()),
//         ) else {
//             continue;
//         };

//         formats.push(Format {
//             name,
//             description,
//             demuxing,
//             muxing,
//         });
//     }

//     Ok(formats)
// }

/// Extracts ffmpeg codecs and wraps into [`Codec`].
async fn ffmpeg_codecs(ffmpeg: &str) -> Result<Vec<FFmpegCodec>, Error> {
    static CODEC_EXTRACTOR: &'static str = r"^ (.{1})(.{1})(.{1})(.{1})(.{1})(.{1}) (\S+) (.+)$";
    static DECODER_EXTRACTOR: &'static str = r"\(decoders: ([^()]+)\)";
    static ENCODER_EXTRACTOR: &'static str = r"\(encoders: ([^()]+)\)";
    static CODEC_REGEX: OnceLock<Regex> = OnceLock::new();
    static DECODER_REGEX: OnceLock<Regex> = OnceLock::new();
    static ENCODER_REGEX: OnceLock<Regex> = OnceLock::new();

    let output = invoke_ffmpeg(ffmpeg, with_default_args!("-codecs")).await?;

    let mut codecs = Vec::with_capacity(512);
    let codec_regex = CODEC_REGEX.get_or_init(|| Regex::new(CODEC_EXTRACTOR).unwrap());
    let decoder_regex = DECODER_REGEX.get_or_init(|| Regex::new(DECODER_EXTRACTOR).unwrap());
    let encoder_regex = ENCODER_REGEX.get_or_init(|| Regex::new(ENCODER_EXTRACTOR).unwrap());
    for line in String::from_utf8_lossy(&output.stdout).lines().skip(12) {
        let Some(caps) = codec_regex.captures(line) else {
            continue;
        };

        // extract flags
        let (
            Some(decode),
            Some(encode),
            Some(r#type),
            Some(intra),
            Some(lossy),
            Some(lossless),
            Some(name),
            Some(mut description),
        ) = (
            caps.get(1).map(|m| m.as_str() == "D"),
            caps.get(2).map(|m| m.as_str() == "E"),
            caps.get(3).and_then(|m| match m.as_str().trim() {
                "V" => Some(FFmpegCodecType::Video),
                "A" => Some(FFmpegCodecType::Audio),
                "S" => Some(FFmpegCodecType::Subtitle),
                "D" => Some(FFmpegCodecType::Data),
                "T" => Some(FFmpegCodecType::Attachment),
                _ => None,
            }),
            caps.get(4).map(|m| m.as_str() == "I"),
            caps.get(5).map(|m| m.as_str() == "L"),
            caps.get(6).map(|m| m.as_str() == "S"),
            caps.get(7).map(|m| m.as_str().trim().to_string()),
            caps.get(8).map(|m| m.as_str().trim().to_string()),
        )
        else {
            continue;
        };

        // extract decoders and encoders from description
        let mut decoders = Vec::new();
        let mut encoders = Vec::new();
        for (regex, coders) in [
            (decoder_regex, &mut decoders),
            (encoder_regex, &mut encoders),
        ] {
            let Some(caps) = regex.captures(&description) else {
                continue;
            };

            let (Some(full), Some(matched)) = (caps.get(0), caps.get(1)) else {
                continue;
            };

            coders.extend(
                matched
                    .as_str()
                    .split(" ")
                    .filter(|coder| !coder.is_empty())
                    .map(|coder| coder.trim().to_string()),
            );
            description.replace_range(full.range(), "");
        }

        // if no decoder or encoder found from description,
        // a decoder or encoder having a same name as codec name existing.
        if decoders.is_empty() && decode {
            decoders.push(name.clone());
        }
        if encoders.is_empty() && encode {
            encoders.push(name.clone());
        }

        codecs.push(FFmpegCodec {
            name,
            description: description.trim().to_string(),
            r#type,
            decode,
            encode,
            intra,
            lossy,
            lossless,
            decoders,
            encoders,
        });
    }

    Ok(codecs)
}
