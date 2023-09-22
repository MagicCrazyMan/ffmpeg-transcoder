use crate::{app::config::Config, handlers::error::Error};

#[derive(Debug, serde::Deserialize)]
pub struct TranscodeItem {
    inputs: Vec<InputParams>,
    outputs: Vec<OutputParams>,
}

#[derive(Debug, serde::Deserialize)]
pub struct InputParams {
    path: String,
    params: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct OutputParams {
    path: String,
    params: Vec<String>,
}

#[tauri::command]
pub async fn transcode(config: tauri::State<'_, Config>, item: TranscodeItem) -> Result<(), Error> {
    todo!()
}
