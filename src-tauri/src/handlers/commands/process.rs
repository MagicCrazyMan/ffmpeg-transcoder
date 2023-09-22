use std::process::Output;

use tokio::process::Command;

use crate::handlers::error::{Error, ErrorKind};

#[macro_export]
macro_rules! with_default_args {
    () => {
        &["-hide_banner"]
    };

    ($($args:expr),+) => {
        &["-hide_banner", $($args),+]
    };
}

/// Invokes ffmpeg in child process and returns output result.
pub async fn invoke_ffmpeg(ffmpeg: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(ffmpeg)
        .args(args)
        .output()
        .await
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => Error::new(ErrorKind::FFmpegNotFound),
            _ => Error::from_raw_error(e, ErrorKind::Internal),
        })?;

    Ok(output)
}

/// Invokes ffprobe in child process and returns output result.
pub async fn invoke_ffprobe(ffprobe: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(ffprobe)
        .args(args)
        .output()
        .await
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => Error::new(ErrorKind::FFprobeNotFound),
            _ => Error::from_raw_error(e, ErrorKind::Internal),
        })?;

    Ok(output)
}
