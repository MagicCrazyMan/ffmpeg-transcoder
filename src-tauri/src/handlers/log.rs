pub static HANDLER_LOGGER_TARGET: &'static str = "Handler";

#[macro_export]
macro_rules! handler_log {
    ($lvl:expr, $($arg:tt)+) => (log::log!(target: $crate::handlers::log::HANDLER_LOGGER_TARGET, $lvl, $($arg)+));
}

#[macro_export]
macro_rules! handler_info {
    ($($arg:tt)+) => ($crate::handler_log!(log::Level::Info, $($arg)+))
}

#[macro_export]
macro_rules! handler_debug {
    ($($arg:tt)+) => ($crate::handler_log!(log::Level::Debug, $($arg)+))
}

#[macro_export]
macro_rules! handler_trace {
    ($($arg:tt)+) => ($crate::handler_log!(log::Level::Trace, $($arg)+))
}

#[macro_export]
macro_rules! handler_warn {
    ($($arg:tt)+) => ($crate::handler_log!(log::Level::Warn, $($arg)+))
}

#[macro_export]
macro_rules! handler_error {
    ($($arg:tt)+) => ($crate::handler_log!(log::Level::Error, $($arg)+))
}
