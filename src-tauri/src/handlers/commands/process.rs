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

async fn invoke(program: &str, args: &[&str]) -> Result<Output, Error> {
    let output = Command::new(program).args(args).output().await;

    match output {
        Ok(output) => Ok(output),
        Err(err) => match err.kind() {
            std::io::ErrorKind::NotFound => Err(Error::ffmpeg_not_found(program)),
            _ => Err(Error::ffmpeg_unavailable(program, err)),
        },
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
