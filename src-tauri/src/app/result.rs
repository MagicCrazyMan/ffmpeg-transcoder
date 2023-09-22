pub type AppResult<T> = Result<T, Box<dyn std::error::Error>>;

/// A trait convert a standard result into a app result.
pub trait IntoAppResult<T> {
    fn into_app_result(self) -> AppResult<T>;
}

impl<T, E> IntoAppResult<T> for std::result::Result<T, E>
where
    E: std::error::Error + 'static,
{
    fn into_app_result(self) -> AppResult<T> {
        match self {
            Ok(v) => Ok(v),
            Err(e) => Err(Box::new(e))
        }
    }
}
