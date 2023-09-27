use std::process::Output;

use tokio::process::Command;

use crate::handlers::error::{Error, ErrorKind};

#[macro_export]
macro_rules! with_default_args {
    () => {
        &["-hide_banner", "-loglevel", "error"]
    };

    ($($args:expr),+) => {
        &["-hide_banner", "-loglevel", "error", $($args),+]
    };
}

async fn invoke(program: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(program).args(args).output().await;

    match output {
        Ok(output) => Ok(output),
        Err(err) => Err(Error::from_raw_error(err, ErrorKind::Internal)),
    }
}

/// Invokes ffmpeg in child process and returns output result after process end.
pub async fn invoke_ffmpeg(ffmpeg: &str, args: &[&str]) -> Result<Output, Error> {
    invoke(ffmpeg, args).await
}

/// Invokes ffprobe in child process and returns output result after process end.
pub async fn invoke_ffprobe(ffprobe: &str, args: &[&str]) -> Result<Output, Error> {
    invoke(ffprobe, args).await
}
