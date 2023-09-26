use std::{borrow::Cow, str::FromStr};

use crate::{
    app::config::Config,
    handlers::{error::Error, store::TranscodeStore},
    with_default_args,
};

#[derive(Debug, serde::Deserialize)]
pub struct TranscodeItem {
    inputs: Vec<InputParams>,
    outputs: Vec<OutputParams>,
}

impl TranscodeItem {
    fn into_args(self) -> Vec<String> {
        let prepend_args = with_default_args!("-progress", "-", "-nostats")
            .iter()
            .map(|str| Cow::Borrowed(*str));
        let input_args = self.inputs.into_iter().flat_map(|input| {
            input
                .params
                .into_iter()
                .map(|param| Cow::Owned(param))
                .chain([
                    Cow::Borrowed("-i"),
                    Cow::Owned(format!("\"{}\"", input.path)),
                ])
        });
        let output_args = self.outputs.into_iter().flat_map(|output| {
            output
                .params
                .into_iter()
                .map(|param| Cow::Owned(param))
                .chain([Cow::Owned(format!("\"{}\"", output.path))])
        });
        let append_args = [Cow::Borrowed("-y")];
        let args = prepend_args
            .chain(input_args)
            .chain(output_args)
            .chain(append_args)
            .filter(|arg| !arg.is_empty())
            .map(|arg| arg.to_string())
            .collect::<Vec<_>>();

        args
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct InputParams {
    path: String,
    #[serde(default = "Vec::new")]
    params: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct OutputParams {
    path: String,
    #[serde(default = "Vec::new")]
    params: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct TranscodeId {
    id: String,
}

/// A command starts a new transcode job.
#[tauri::command]
pub async fn start_transcode(
    app_handle: tauri::AppHandle,
    config: tauri::State<'_, Config>,
    transcode_store: tauri::State<'_, TranscodeStore>,
    item: TranscodeItem,
) -> Result<TranscodeId, Error> {
    let id = transcode_store
        .add_and_start(
            app_handle,
            config.binary().ffmpeg().to_string(),
            item.into_args(),
        )
        .await?;

    Ok(TranscodeId { id: id.to_string() })
}

/// A command stops a new transcode job.
#[tauri::command]
pub async fn stop_transcode(
    transcode_store: tauri::State<'_, TranscodeStore>,
    id: String,
) -> Result<(), ()> {
    let id = uuid::Uuid::from_str(&id).unwrap();
    transcode_store.stop(&id).await;
    Ok(())
}

/// A command pauses a new transcode job.
#[tauri::command]
pub async fn pause_transcode(
    transcode_store: tauri::State<'_, TranscodeStore>,
    id: String,
) -> Result<(), ()> {
    let id = uuid::Uuid::from_str(&id).unwrap();
    transcode_store.pause(&id).await;
    Ok(())
}

/// A command resumes a new transcode job.
#[tauri::command]
pub async fn resume_transcode(
    transcode_store: tauri::State<'_, TranscodeStore>,
    id: String,
) -> Result<(), ()> {
    let id = uuid::Uuid::from_str(&id).unwrap();
    transcode_store.resume(&id).await;
    Ok(())
}
