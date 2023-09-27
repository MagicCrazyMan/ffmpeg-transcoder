use std::fmt::Display;

/// An error that aims to send error information to frontend.
/// For i18n purpose, when an error thrown, it does not send text to frontend,
/// otherwise, it send only an [`ErrorKind`] and some necessary keywords.
/// Then, frontend will buildup messages for different language itself.
#[derive(Debug, serde::Serialize)]
#[non_exhaustive]
pub enum Error {
    /// Fallback error
    Internal {
        code: usize,
        #[serde(skip_serializing)]
        raw_error: Box<dyn std::error::Error>,
    },
    FFmpegNotFound {
        code: usize,
        #[serde(skip_serializing)]
        program: String,
    },
    FFprobeNotFound {
        code: usize,
        #[serde(skip_serializing)]
        program: String,
    },
    FFmpegUnavailable {
        code: usize,
        #[serde(skip_serializing)]
        program: String,
        #[serde(skip_serializing)]
        raw_error: Box<dyn std::error::Error>,
    },
    FFprobeUnavailable {
        code: usize,
        #[serde(skip_serializing)]
        program: String,
        #[serde(skip_serializing)]
        raw_error: Box<dyn std::error::Error>,
    },
    DirectoryNotFound {
        code: usize,
        path: String,
    },
    TaskIdUnavailable {
        code: usize,
        id: String,
    },
    TaskNotFound {
        code: usize,
        id: String,
    },
}

impl Error {
    pub fn internal<E>(raw_error: E) -> Self
    where
        E: std::error::Error + 'static,
    {
        Self::Internal {
            code: 0,
            raw_error: Box::new(raw_error),
        }
    }

    pub fn ffmpeg_not_found<S>(program: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFmpegNotFound {
            code: 1,
            program: program.into(),
        }
    }

    pub fn ffprobe_not_found<S>(program: S) -> Self
    where
        S: Into<String>,
    {
        Self::FFprobeNotFound {
            code: 2,
            program: program.into(),
        }
    }

    pub fn ffmpeg_unavailable<S, E>(program: S, raw_error: E) -> Self
    where
        S: Into<String>,
        E: std::error::Error + 'static,
    {
        Self::FFmpegUnavailable {
            code: 3,
            program: program.into(),
            raw_error: Box::new(raw_error),
        }
    }

    pub fn ffprobe_unavailable<S, E>(program: S, raw_error: E) -> Self
    where
        S: Into<String>,
        E: std::error::Error + 'static,
    {
        Self::FFprobeUnavailable {
            code: 4,
            program: program.into(),
            raw_error: Box::new(raw_error),
        }
    }

    pub fn directory_not_found<S>(path: S) -> Self
    where
        S: Into<String>,
    {
        Self::DirectoryNotFound {
            code: 5,
            path: path.into(),
        }
    }

    pub fn task_id_unavailable<S>(id: S) -> Self
    where
        S: Into<String>,
    {
        Self::TaskIdUnavailable {
            code: 6,
            id: id.into(),
        }
    }

    pub fn task_not_found<S>(id: S) -> Self
    where
        S: Into<String>,
    {
        Self::TaskNotFound {
            code: 7,
            id: id.into(),
        }
    }

    pub fn code(&self) -> usize {
        match self {
            Error::Internal { code, .. } => *code,
            Error::FFmpegNotFound { code, .. } => *code,
            Error::FFprobeNotFound { code, .. } => *code,
            Error::FFmpegUnavailable { code, .. } => *code,
            Error::FFprobeUnavailable { code, .. } => *code,
            Error::DirectoryNotFound { code, .. } => *code,
            Error::TaskIdUnavailable { code, .. } => *code,
            Error::TaskNotFound { code, .. } => *code,
        }
    }
}

impl std::error::Error for Error {}

impl Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Internal { raw_error, .. } => {
                f.write_fmt(format_args!("internal error: {}", raw_error))
            }
            Error::FFmpegNotFound { program, .. } => {
                f.write_fmt(format_args!("ffmpeg binary not found: \"{}\"", program))
            }
            Error::FFprobeNotFound { program, .. } => {
                f.write_fmt(format_args!("ffprobe binary not found: \"{}\"", program))
            }
            Error::FFmpegUnavailable {
                program, raw_error, ..
            } => f.write_fmt(format_args!(
                "ffmpeg binary unavailable: \"{}\" {}",
                program, raw_error
            )),
            Error::FFprobeUnavailable {
                program, raw_error, ..
            } => f.write_fmt(format_args!(
                "ffmpeg binary unavailable: \"{}\" {}",
                program, raw_error
            )),
            Error::DirectoryNotFound { path, .. } => {
                f.write_fmt(format_args!("directory not found: \"{}\"", path))
            }
            Error::TaskIdUnavailable { id, .. } => {
                f.write_fmt(format_args!("task id unavailable: \"{}\"", id))
            }
            Error::TaskNotFound { id, .. } => {
                f.write_fmt(format_args!("task with specified id not found: \"{}\"", id))
            }
        }
    }
}
