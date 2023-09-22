use std::process::Output;

use tokio::{process::Command, sync::watch::Sender};

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

trait IntoResult<T> {
    fn into_result(self) -> Result<T, Error>;
}

impl<T> IntoResult<T> for std::io::Result<T> {
    fn into_result(self) -> Result<T, Error> {
        match self {
            Ok(v) => Ok(v),
            Err(e) => match e.kind() {
                std::io::ErrorKind::NotFound => Err(Error::new(ErrorKind::FFmpegNotFound)),
                _ => Err(Error::from_raw_error(e, ErrorKind::Internal)),
            },
        }
    }
}

/// Invokes ffmpeg in child process and
/// streaming reading output from stdout & stderr.
pub async fn stream_ffmpeg(
    ffmpeg: &str,
    args: &[&str],
    notifier: Sender<String>,
) -> Result<(), Error> {
    let mut child = Command::new(ffmpeg).args(args).spawn().into_result()?;

    child.wait().await.into_result()?;

    Ok(())
}

/// Invokes ffmpeg in child process and returns output result after process end.
pub async fn invoke_ffmpeg(ffmpeg: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(ffmpeg)
        .args(args)
        .output()
        .await
        .into_result()?;

    Ok(output)
}

/// Invokes ffprobe in child process and returns output result after process end.
pub async fn invoke_ffprobe(ffprobe: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(ffprobe)
        .args(args)
        .output()
        .await
        .into_result()?;

    Ok(output)
}
