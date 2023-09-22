/// Tauri application backend logger target
pub static APP_LOGGER_TARGET: &'static str = "App";

#[macro_export]
macro_rules! app_log {
    ($lvl:expr, $($arg:tt)+) => (log::log!(target: $crate::app::log::APP_LOGGER_TARGET, $lvl, $($arg)+));
}

#[macro_export]
macro_rules! app_info {
    ($($arg:tt)+) => ($crate::app_log!(log::Level::Info, $($arg)+))
}


#[macro_export]
macro_rules! app_debug {
    ($($arg:tt)+) => ($crate::app_log!(log::Level::Debug, $($arg)+))
}


#[macro_export]
macro_rules! app_trace {
    ($($arg:tt)+) => ($crate::app_log!(log::Level::Trace, $($arg)+))
}


#[macro_export]
macro_rules! app_warn {
    ($($arg:tt)+) => ($crate::app_log!(log::Level::Warn, $($arg)+))
}


#[macro_export]
macro_rules! app_error {
    ($($arg:tt)+) => ($crate::app_log!(log::Level::Error, $($arg)+))
}
