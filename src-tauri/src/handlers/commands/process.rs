use std::process::Output;

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

/// Invokes ffmpeg in child process and returns output result after process end.
pub async fn invoke_ffmpeg(ffmpeg: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(ffmpeg).args(args).output().await;

    match output {
        Ok(output) => Ok(output),
        Err(err) => match err.kind() {
            std::io::ErrorKind::NotFound => Err(Error::ffmpeg_not_found(ffmpeg)),
            _ => Err(Error::ffmpeg_unavailable_with_raw_error(ffmpeg, err)),
        },
    }
}

/// Invokes ffprobe in child process and returns output result after process end.
pub async fn invoke_ffprobe(ffprobe: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(ffprobe).args(args).output().await;

    match output {
        Ok(output) => Ok(output),
        Err(err) => match err.kind() {
            std::io::ErrorKind::NotFound => Err(Error::ffprobe_not_found(ffprobe)),
            _ => Err(Error::ffprobe_unavailable_with_raw_error(ffprobe, err)),
        },
    }
}
