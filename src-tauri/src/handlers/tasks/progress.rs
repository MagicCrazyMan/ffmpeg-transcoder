use std::{ffi::OsStr, sync::OnceLock};

use ordered_float::OrderedFloat;
use regex::Regex;
use smallvec::SmallVec;

use crate::{
    handlers::{
        commands::{
            process::invoke_ffprobe,
            task::{TaskInputArgs, TaskOutputArgs},
        },
        error::Error,
    },
    with_default_args,
};

use super::task::Task;

#[derive(Debug, Clone, Copy, serde::Serialize)]
#[serde(tag = "type")]
pub enum ProgressType {
    ByDuration { duration: f64 },
    ByFileSize { size: usize },
    Unspecified,
}

/// No FileSize for input progress source because
/// we can do nothing by input file size since
/// ffmpeg tells us nothing about input size during transcoding
enum InputProgressSource {
    Duration(f64),
    Unspecified,
}

enum OutputProgressSource {
    Duration(f64),
    DurationOffset(f64),
    FileSize(usize),
    Unspecified,
}

/// Finds progress type. Following rules below in order:
///
/// 1. For both input and output progress sources, ignores `Unspecified`.
/// 2. If input progress sources are all [`FileSize`](OutputProgressSource::FileSize),
/// 2. If output progress sources are all [`FileSize`](OutputProgressSource::FileSize),
/// returns [`ProgressType::ByFileSize`] with file sizes summing up.
/// 3. If output progress sources are all [`Duration`](OutputProgressSource::Duration),
/// returns [`ProgressType::ByDuration`] with the maximum duration.
/// 4. If output progress sources are all [`AddDuration`](OutputProgressSource::AddDuration):
///     1. If input progress sources have any [`Duration`](InputProgressSource::Duration),
///     finds the maximum input duration and applies offset to the input duration,
///     then returns [`ProgressType::ByDuration`]
///     2. Returns [`ProgressType::Unspecified`] if having no input duration.
/// 5. Returns [`ProgressType::Unspecified`] for all situations else.
pub async fn find_progress_type(task: &Task) -> Result<ProgressType, Error> {
    let mut output_progress_sources = Vec::with_capacity(task.data.args.outputs.len());
    for output in task.data.args.outputs.iter() {
        output_progress_sources.push(find_output_progress_sources(output));
    }

    let (durations, offsets, sizes) = output_progress_sources.iter().fold(
        (
            SmallVec::<[OrderedFloat<f64>; 10]>::new(),
            SmallVec::<[OrderedFloat<f64>; 10]>::new(),
            SmallVec::<[usize; 10]>::new(),
        ),
        |mut list, source| {
            match source {
                OutputProgressSource::Duration(a) => list.0.push(OrderedFloat(*a)),
                OutputProgressSource::DurationOffset(a) => list.1.push(OrderedFloat(*a)),
                OutputProgressSource::FileSize(a) => list.2.push(*a),
                OutputProgressSource::Unspecified => {}
            }
            return list;
        },
    );

    if sizes.len() != 0 && durations.len() == 0 && offsets.len() == 0 {
        Ok(ProgressType::ByFileSize {
            size: sizes.iter().sum(),
        })
    } else if sizes.len() == 0 && durations.len() != 0 && offsets.len() == 0 {
        Ok(ProgressType::ByDuration {
            duration: durations.iter().max().unwrap().0,
        })
    } else if durations.len() == 0 && sizes.len() == 0 && offsets.len() != 0 {
        let mut input_progress_sources = Vec::with_capacity(task.data.args.inputs.len());

        for input in task.data.args.inputs.iter() {
            let progress_type =
                find_input_progress_sources(&task.data.ffprobe_program, input).await?;
            input_progress_sources.push(progress_type);
        }

        let max_duration =
            input_progress_sources
                .iter()
                .fold(None as Option<f64>, |mut max, source| {
                    match source {
                        InputProgressSource::Duration(d) => match max {
                            Some(m) => max = Some(m.max(*d)),
                            None => max = Some(*d),
                        },
                        InputProgressSource::Unspecified => {}
                    }
                    return max;
                });

        if let Some(max_duration) = max_duration {
            let offset = offsets.iter().max().unwrap().0;
            Ok(ProgressType::ByDuration {
                duration: max_duration - offset,
            })
        } else {
            Ok(ProgressType::Unspecified)
        }
    } else {
        Ok(ProgressType::Unspecified)
    }
}

/// Finds progress type from input arguments
async fn find_input_progress_sources(
    ffprobe: &str,
    input: &TaskInputArgs,
) -> Result<InputProgressSource, Error> {
    let raw = invoke_ffprobe(
        ffprobe,
        with_default_args!(
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            &input.path
        ),
    )
    .await?;
    let Ok(duration) = String::from_utf8_lossy(&raw.stdout).trim().parse::<f64>() else {
        return Ok(InputProgressSource::Unspecified);
    };

    let (ss, sseof, to, t, fs) = find_progress_args(&input.args);

    if let Some(_) = fs {
        Ok(InputProgressSource::Unspecified)
    } else {
        // applies clipping
        let duration = match (ss, sseof, to, t) {
            (None, None, None, None) => duration,
            (None, None, _, Some(t)) => t.min(duration),
            (None, None, Some(to), None) => to.min(duration),
            (None, Some(sseof), None, None) => {
                if sseof > 0.0 {
                    0.0 // error
                } else {
                    duration + sseof
                }
            }
            (None, Some(sseof), _, Some(t)) => {
                if sseof > 0.0 {
                    0.0 // error
                } else {
                    let ss = duration + sseof;
                    let to = (ss + t).min(duration);

                    to - ss
                }
            }
            (None, Some(sseof), Some(to), None) => {
                if sseof > 0.0 {
                    0.0 // error
                } else {
                    let ss = duration + sseof;
                    let to = to.min(duration);

                    if ss > to {
                        sseof.abs()
                    } else {
                        to - ss
                    }
                }
            }
            (Some(ss), None, None, None) => duration - ss,
            (Some(ss), _, _, Some(t)) => {
                let ss = ss.min(duration);
                let to = (ss + t).min(duration);
                to - ss
            }
            (Some(ss), _, Some(to), None) => {
                if ss > to {
                    0.0 // error
                } else {
                    if ss < 0.0 {
                        // strange behavior done by ffmpeg, i don't know why as well
                        ss.abs() * 2.0 + to
                    } else {
                        let ss = ss.min(duration);
                        let to = to.min(duration);
                        to - ss
                    }
                }
            }
            (Some(ss), Some(_), None, None) => duration - ss.min(duration),
        };

        Ok(InputProgressSource::Duration(duration))
    }
}

/// Finds progress type from output arguments
fn find_output_progress_sources(output: &TaskOutputArgs) -> OutputProgressSource {
    // -sseof not works on output
    let (ss, _, to, t, fs) = find_progress_args(&output.args);

    if let Some(size) = fs {
        OutputProgressSource::FileSize(size)
    } else {
        match (ss, to, t) {
            (None, None, None) => OutputProgressSource::Unspecified,
            (_, _, Some(t)) => OutputProgressSource::Duration(t),
            (None, Some(to), None) => OutputProgressSource::Duration(to),
            // ffmpeg prints nothing before reaching -ss position
            (Some(ss), None, None) => OutputProgressSource::DurationOffset(ss),
            (Some(ss), Some(to), None) => OutputProgressSource::Duration(to - ss),
        }
    }
}

/// Finds arguments that used for progressing, in (-ss, -sseof, -to, -t, -fs) order.
fn find_progress_args<I, S>(
    args: I,
) -> (
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<usize>,
)
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut ss: Option<f64> = None;
    let mut sseof: Option<f64> = None;
    let mut to: Option<f64> = None;
    let mut t: Option<f64> = None;
    let mut fs: Option<usize> = None;

    let mut iter = args.into_iter();
    while let Some(arg) = iter.next() {
        let arg = arg.as_ref().to_string_lossy();
        let arg = arg.as_ref();

        let value = match arg {
            "-ss" | "-sseof" | "-to" | "-t" | "-fs" => {
                let Some(value) = iter.next() else {
                    break;
                };
                value
            }
            _ => {
                continue;
            }
        };

        match arg {
            "-ss" => {
                ss = extract_duration(value);
            }
            "-sseof" => {
                sseof = extract_duration(value);
            }
            "-to" => {
                to = extract_duration(value);
            }
            "-t" => {
                t = extract_duration(value);
            }
            "-fs" => {
                let value = value.as_ref();
                fs = value.to_string_lossy().parse::<usize>().ok();
            }
            _ => {}
        };
    }

    (ss, sseof, to, t, fs)
}

/// Extracts duration in seconds from value.
///
/// Sees [FFmpeg document](https://ffmpeg.org/ffmpeg-utils.html#time-duration-syntax)
/// and [FFmpeg utils](https://ffmpeg.org/ffmpeg-utils.html#time-duration-syntax)
/// for more details.
fn extract_duration<S: AsRef<OsStr>>(value: S) -> Option<f64> {
    static DURATION_TYPE1_EXTRACTOR: &'static str =
        r"^(-?)(?:(\d+):{1})?(\d{1,2}):(\d{1,2})(?:\.{1}(\d+))?$";
    static DURATION_TYPE2_EXTRACTOR: &'static str = r"^(-?)(\d+)(?:\.{1}(\d+))?(s|ms|us?)?$";
    static DURATION_TYPE1_REGEX: OnceLock<Regex> = OnceLock::new();
    static DURATION_TYPE2_REGEX: OnceLock<Regex> = OnceLock::new();

    let value = value.as_ref().to_string_lossy();
    let value = value.as_ref();

    // tries to extract duration by type 1
    let duration_type1_regex =
        DURATION_TYPE1_REGEX.get_or_init(|| Regex::new(DURATION_TYPE1_EXTRACTOR).unwrap());
    let duration = duration_type1_regex.captures(value).and_then(|caps| {
        if let (negative, hours, Some(mins), Some(secs), milliseconds) = (
            caps.get(1)
                .map(|value| if value.as_str() == "-" { true } else { false }),
            caps.get(2)
                .and_then(|value| value.as_str().parse::<f64>().ok()),
            caps.get(3)
                .and_then(|value| value.as_str().parse::<f64>().ok()),
            caps.get(4)
                .and_then(|value| value.as_str().parse::<f64>().ok()),
            caps.get(5)
                .and_then(|value| value.as_str().parse::<f64>().ok()),
        ) {
            let mut secs = hours.unwrap_or(0.0) * 3600.0
                + mins * 60.0
                + secs
                + milliseconds.unwrap_or(0.0) / 1000.0;

            if negative.unwrap_or(false) {
                secs = -secs
            }

            Some(secs)
        } else {
            None
        }
    });

    if duration.is_some() {
        return duration;
    }

    // tries to extract duration by type 2
    enum Unit {
        Second,
        Milliseconds,
        Microseconds,
        Unknown,
    }
    let duration_type2_regex =
        DURATION_TYPE2_REGEX.get_or_init(|| Regex::new(DURATION_TYPE2_EXTRACTOR).unwrap());
    let duration = duration_type2_regex.captures(value).and_then(|caps| {
        if let (negative, Some(integer), decimals, unit) = (
            caps.get(1)
                .map(|value| if value.as_str() == "-" { true } else { false }),
            caps.get(2)
                .and_then(|value| value.as_str().parse::<f64>().ok()),
            caps.get(3)
                .and_then(|value| value.as_str().parse::<f64>().ok()),
            caps.get(4)
                .map(|value| match value.as_str() {
                    "s" => Unit::Second,
                    "ms" => Unit::Milliseconds,
                    "us" => Unit::Microseconds,
                    _ => Unit::Unknown,
                })
                .unwrap_or(Unit::Second),
        ) {
            let mut secs = match unit {
                Unit::Second => integer + decimals.unwrap_or(0.0),
                Unit::Milliseconds => (integer + decimals.unwrap_or(0.0)) / 1000.0,
                Unit::Microseconds => (integer + decimals.unwrap_or(0.0)) / 1000000.0,
                Unit::Unknown => return None,
            };

            if negative.unwrap_or(false) {
                secs = -secs
            }

            Some(secs)
        } else {
            None
        }
    });

    duration
}
