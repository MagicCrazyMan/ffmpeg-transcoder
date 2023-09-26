use std::{borrow::Cow, fmt::Display};

use crate::handler_error;

/// Error kinds of [`Error`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde_repr::Serialize_repr)]
#[repr(u8)]
pub enum ErrorKind {
    Internal = 0,
    FFmpegNotFound = 1,
    FFprobeNotFound = 2,
    FFmpegUnavailable = 3,
    FFprobeUnavailable = 4,
    DirectoryNotFound = 5,
    IncorrectJobId = 6,
}

/// An error that aims to send error information to frontend.
/// For i18n purpose, when an error thrown, it does not send text to frontend,
/// otherwise, it send only an [`ErrorKind`] and some necessary keywords.
/// Then, frontend will buildup messages for different language itself.
#[derive(Debug, serde::Serialize)]
pub struct Error {
    kind: ErrorKind,
    keywords: Vec<String>,
    #[serde(skip_serializing)]
    raw_error: Option<Box<dyn std::error::Error>>,
}

impl Error {
    /// Creates a new error with specified [`ErrorKind`].
    pub fn new(kind: ErrorKind) -> Self {
        Self::new_with_keywords(kind, Vec::new())
    }

    /// Creates a new error with specified [`ErrorKind`] and keywords.
    pub fn new_with_keywords(kind: ErrorKind, keywords: Vec<String>) -> Self {
        Self::new_inner(None, kind, keywords)
    }

    /// Creates a new error with specified [`ErrorKind`] containing a raw error.
    pub fn from_raw_error<E>(raw_error: E, kind: ErrorKind) -> Self
    where
        E: std::error::Error + 'static,
    {
        Self::from_raw_error_with_keywords(raw_error, kind, Vec::new())
    }

    /// Creates a new error with specified [`ErrorKind`] and keywords containing a raw error.
    pub fn from_raw_error_with_keywords<E>(
        raw_error: E,
        kind: ErrorKind,
        keywords: Vec<String>,
    ) -> Self
    where
        E: std::error::Error + 'static,
    {
        Self::new_inner(Some(Box::new(raw_error)), kind, keywords)
    }

    fn new_inner(
        raw_error: Option<Box<dyn std::error::Error>>,
        kind: ErrorKind,
        keywords: Vec<String>,
    ) -> Self {
        let error = Self {
            raw_error,
            kind,
            keywords,
        };

        handler_error!("{}", error);

        error
    }

    /// Gets [`ErrorKind`].
    pub fn kind(&self) -> ErrorKind {
        self.kind
    }

    /// Gets message keywords.
    pub fn keywords(&self) -> &[String] {
        self.keywords.as_slice()
    }

    /// Gets raw error.
    pub fn raw_error(&self) -> Option<&dyn std::error::Error> {
        self.raw_error.as_ref().and_then(|err| Some(err.as_ref()))
    }
}

impl std::error::Error for Error {}

impl Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let msg = self
            .raw_error()
            .map(|err| Cow::Owned(err.to_string()))
            .unwrap_or(Cow::Borrowed("no further information"));

        match self.kind() {
            ErrorKind::Internal => f.write_fmt(format_args!("internal error: {}", msg)),
            ErrorKind::FFmpegNotFound => f.write_str("ffmpeg binary not found"),
            ErrorKind::FFprobeNotFound => f.write_str("ffprobe binary not found"),
            ErrorKind::FFmpegUnavailable => f.write_str("ffmpeg binary unavailable"),
            ErrorKind::FFprobeUnavailable => f.write_str("ffprobe binary unavailable"),
            ErrorKind::DirectoryNotFound => f.write_fmt(format_args!(
                "directory \"{}\" not found",
                self.keywords
                    .get(0)
                    .map(|d| d.as_str())
                    .unwrap_or("unknown")
            )),
            ErrorKind::IncorrectJobId => f.write_fmt(format_args!(
                "job with id {} not found",
                self.keywords
                    .get(0)
                    .map(|d| d.as_str())
                    .unwrap_or("unknown")
            )),
        }
    }
}

/// A generic trait wrapping all error result into [`Error`] result
/// with [`ErrorKind::Internal`] and without keywords.
pub trait IntoInternalResult<T> {
    fn into_internal_result(self) -> Result<T, Error>;
}

impl<T, E> IntoInternalResult<T> for std::result::Result<T, E>
where
    E: std::error::Error + 'static,
{
    fn into_internal_result(self) -> Result<T, Error> {
        match self {
            Ok(v) => Ok(v),
            Err(err) => Err(Error::from_raw_error(err, ErrorKind::Internal)),
        }
    }
}
