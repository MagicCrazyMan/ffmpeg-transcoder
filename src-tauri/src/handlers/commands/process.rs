use std::{ffi::OsStr, process::Output};

use tokio::process::Command;

use crate::handlers::error::Error;

#[macro_export]
macro_rules! with_default_args {
    () => {
        &["-hide_banner", "-loglevel", "error"]
    };

    ($($args:expr),+) => {
        &["-hide_banner", "-loglevel", "error", $($args),+]
    };
}

pub fn create_process<I, S>(program: &str, args: I) -> Command
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut command = Command::new(program);

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    };

    command.args(args);
    command
}

/// Invokes ffmpeg in child process and returns output result after process end.
pub async fn invoke_ffmpeg<I, S>(ffmpeg: &str, args: I) -> Result<Output, Error>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = create_process(ffmpeg, args).output().await;

    match output {
        Ok(output) => Ok(output),
        Err(err) => match err.kind() {
            std::io::ErrorKind::NotFound => Err(Error::ffmpeg_not_found(ffmpeg)),
            _ => Err(Error::ffmpeg_unavailable_with_raw_error(ffmpeg, err)),
        },
    }
}

/// Invokes ffprobe in child process and returns output result after process end.
pub async fn invoke_ffprobe<I, S>(ffprobe: &str, args: I) -> Result<Output, Error>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = create_process(ffprobe, args).output().await;

    match output {
        Ok(output) => Ok(output),
        Err(err) => match err.kind() {
            std::io::ErrorKind::NotFound => Err(Error::ffprobe_not_found(ffprobe)),
            _ => Err(Error::ffprobe_unavailable_with_raw_error(ffprobe, err)),
        },
    }
}

/// Invokes ffprobe in child process and gets media metadata in JSON format,
/// Result is not deserialize for performance considering.
pub async fn invoke_ffprobe_json_metadata(ffprobe: &str, path: &str) -> Result<String, Error> {
    let output = invoke_ffprobe(
        ffprobe,
        with_default_args! {
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            "-show_chapters",
            &path
        },
    )
    .await?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.is_empty() {
        Err(Error::ffprobe_runtime_error(stderr.to_string()))
    } else {
        let stdout: std::borrow::Cow<'_, str> = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    }
}
