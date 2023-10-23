use std::fmt::Display;

/// An error that aims to send error information to frontend.
/// For i18n purpose, when an error thrown, it does not send text to frontend,
/// otherwise, it send only an [`ErrorKind`] and some necessary keywords.
/// Then, frontend will buildup messages for different language itself.
#[derive(Debug, serde::Serialize)]
#[serde(tag = "type")]
#[non_exhaustive]
pub enum Error {
    /// Fallback error
    Internal {
        #[serde(skip_serializing)]
        raw_error: Box<dyn std::error::Error + Send>,
    },
    ProcessUnexpectedKilled,
    FFmpegNotFound {
        #[serde(skip_serializing)]
        program: String,
    },
    FFprobeNotFound {
        #[serde(skip_serializing)]
        program: String,
    },
    FFmpegUnavailable {
        #[serde(skip_serializing)]
        program: String,
        #[serde(skip_serializing)]
        raw_error: Option<Box<dyn std::error::Error + Send>>,
    },
    FFprobeUnavailable {
        #[serde(skip_serializing)]
        program: String,
        #[serde(skip_serializing)]
        raw_error: Option<Box<dyn std::error::Error + Send>>,
    },
    FFmpegRuntimeError {
        reason: String,
    },
    FFprobeRuntimeError {
        reason: String,
    },
    DirectoryNotFound {
        path: String,
    },
    TaskNotFound {
        id: String,
    },
    TaskExisting {
        id: String,
    },
    ConfigurationNotLoaded,
    ConfigurationUnavailable {
        reasons: Vec<Error>,
    },
}

impl Error {
    pub fn internal<E>(raw_error: E) -> Self
    where
        E: std::error::Error + Send + 'static,
    {
        Self::Internal {
            raw_error: Box::new(raw_error),
        }
    }

    pub fn process_unexpected_killed() -> Self {
        Self::ProcessUnexpectedKilled
    }

    pub fn ffmpeg_not_found<S>(program: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFmpegNotFound {
            program: program.into(),
        }
    }

    pub fn ffprobe_not_found<S>(program: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFprobeNotFound {
            program: program.into(),
        }
    }

    pub fn ffmpeg_unavailable_with_raw_error<S, E>(program: S, raw_error: E) -> Self
    where
        S: Into<String>,
        E: std::error::Error + Send + 'static,
    {
        Self::FFmpegUnavailable {
            program: program.into(),
            raw_error: Some(Box::new(raw_error)),
        }
    }

    pub fn ffmpeg_unavailable<S>(program: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFmpegUnavailable {
            program: program.into(),
            raw_error: None,
        }
    }

    pub fn ffprobe_unavailable_with_raw_error<S, E>(program: S, raw_error: E) -> Self
    where
        S: Into<String>,
        E: std::error::Error + Send + 'static,
    {
        Self::FFprobeUnavailable {
            program: program.into(),
            raw_error: Some(Box::new(raw_error)),
        }
    }

    pub fn ffprobe_unavailable<S>(program: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFprobeUnavailable {
            program: program.into(),
            raw_error: None,
        }
    }

    pub fn ffmpeg_runtime_error<S>(reason: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFmpegRuntimeError {
            reason: reason.into(),
        }
    }

    pub fn ffprobe_runtime_error<S>(reason: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFprobeRuntimeError {
            reason: reason.into(),
        }
    }

    pub fn directory_not_found<S>(path: S) -> Self
    where
        S: Into<String>,
    {
        Self::DirectoryNotFound { path: path.into() }
    }

    pub fn task_not_found<S>(id: S) -> Self
    where
        S: Into<String>,
    {
        Self::TaskNotFound { id: id.into() }
    }

    pub fn task_existing<S>(id: S) -> Self
    where
        S: Into<String>,
    {
        Self::TaskExisting { id: id.into() }
    }

    pub fn configuration_not_loaded() -> Self {
        Self::ConfigurationNotLoaded
    }

    pub fn configuration_unavailable(reasons: Vec<Self>) -> Self {
        Self::ConfigurationUnavailable { reasons }
    }
}

impl std::error::Error for Error {}

impl Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Internal { raw_error, .. } => {
                f.write_fmt(format_args!("internal error: {}", raw_error))
            }
            Error::ProcessUnexpectedKilled => f.write_str("process unexpected killed"),
            Error::FFmpegNotFound { program, .. } => {
                f.write_fmt(format_args!("ffmpeg binary not found: \"{}\"", program))
            }
            Error::FFprobeNotFound { program, .. } => {
                f.write_fmt(format_args!("ffprobe binary not found: \"{}\"", program))
            }
            Error::FFmpegUnavailable {
                program, raw_error, ..
            } => match raw_error {
                Some(err) => f.write_fmt(format_args!(
                    "ffmpeg binary unavailable: \"{}\" {}",
                    program, err
                )),
                None => f.write_fmt(format_args!("ffmpeg binary unavailable: \"{}\"", program,)),
            },
            Error::FFprobeUnavailable {
                program, raw_error, ..
            } => match raw_error {
                Some(err) => f.write_fmt(format_args!(
                    "ffprobe binary unavailable: \"{}\" {}",
                    program, err
                )),
                None => f.write_fmt(format_args!("ffprobe binary unavailable: \"{}\"", program,)),
            },
            Error::FFmpegRuntimeError { reason } => {
                f.write_fmt(format_args!("ffmpeg runtime error: {}", reason))
            }
            Error::FFprobeRuntimeError { reason } => {
                f.write_fmt(format_args!("ffprobe runtime error: {}", reason))
            }
            Error::DirectoryNotFound { path, .. } => {
                f.write_fmt(format_args!("directory not found: \"{}\"", path))
            }
            Error::TaskNotFound { id, .. } => {
                f.write_fmt(format_args!("task with specified id not found: \"{}\"", id))
            }
            Error::TaskExisting { id, .. } => {
                f.write_fmt(format_args!("task with specified id is existing: \"{}\"", id))
            }
            Error::ConfigurationNotLoaded => f.write_str("configuration not loaded"),
            Error::ConfigurationUnavailable { reasons } => {
                #[cfg(windows)]
                static LINE_ENDING: &'static str = "\r\n";
                #[cfg(not(windows))]
                static LINE_ENDING: &'static str = "\n";

                f.write_fmt(format_args!(
                    "configuration unavailable: {}",
                    reasons
                        .iter()
                        .map(|reason| reason.to_string())
                        .collect::<Vec<_>>()
                        .join(LINE_ENDING),
                ))
            }
        }
    }
}
