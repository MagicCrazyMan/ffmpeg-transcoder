// use crate::{app::config::Config, handlers::error::Error, with_default_args};

// use super::process::invoke_ffprobe;

// /// Gets media properties using ffprobe.
// /// Preventing unnecessary conversion between json object and plain text,
// /// this command return plain json text from stdout directly without serializing to json object.
// #[tauri::command]
// pub async fn media_metadata(
//     config: tauri::State<'_, Config>,
//     path: String,
// ) -> Result<String, Error> {
//     let output = invoke_ffprobe(
//         config.binary().ffprobe(),
//         with_default_args! {
//             "-print_format",
//             "json",
//             "-show_format",
//             "-show_streams",
//             "-show_chapters",
//             &path
//         },
//     )
//     .await?;

//     Ok(String::from_utf8_lossy(&output.stdout).to_string())
// }
