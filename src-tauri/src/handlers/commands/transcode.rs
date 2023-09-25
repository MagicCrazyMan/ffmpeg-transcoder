use std::{borrow::Cow, process::Stdio, str::FromStr};

use log::{debug, info};
use tokio::process::Command;

use crate::{
    app::config::Config,
    handlers::{
        error::Error,
        store::{Transcoding, TranscodingStore},
    },
    with_default_args,
};

#[derive(Debug, serde::Deserialize)]
pub struct TranscodeItem {
    inputs: Vec<InputParams>,
    outputs: Vec<OutputParams>,
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

#[tauri::command]
pub async fn start_transcode(
    app_handle: tauri::AppHandle,
    config: tauri::State<'_, Config>,
    transcode_store: tauri::State<'_, TranscodingStore>,
    item: TranscodeItem,
) -> Result<TranscodeId, Error> {
    let args = with_default_args!("-progress", "-", "-nostats")
        .iter()
        .map(|str| *str)
        .chain(item.inputs.iter().flat_map(|input| {
            input
                .params
                .iter()
                .map(|param| param.as_str())
                .chain(["-i", input.path.as_str()])
        }))
        .chain(item.outputs.iter().flat_map(|output| {
            output
                .params
                .iter()
                .map(|param| param.as_str())
                .chain([output.path.as_str()])
        }))
        .chain(["-y"])
        .filter(|arg| !arg.is_empty())
        .collect::<Vec<_>>();

    info!(
        "Start transcode with arguments: {} {}",
        config.binary().ffmpeg(),
        args.join(" ")
    );

    let child = Command::new(config.binary().ffmpeg())
        .args(args)
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let pid = child.id();

    let id = uuid::Uuid::new_v4();
    transcode_store
        .add(id, Transcoding::new(child, app_handle))
        .await;

    debug!(
        "Start transcoding: {}, OS-assigned PID: {}",
        id,
        pid.map(|id| Cow::Owned(id.to_string()))
            .unwrap_or(Cow::Borrowed("unknown"))
    );

    Ok(TranscodeId { id: id.to_string() })
}

#[tauri::command]
pub async fn stop_transcode(
    transcode_store: tauri::State<'_, TranscodingStore>,
    id: String,
) -> Result<(), ()> {
    let id = uuid::Uuid::from_str(&id).unwrap();

    debug!("Stopping transcoding: {}", id);

    transcode_store.stop(&id).await;

    debug!("Stopped transcoding: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn pause_transcode(
    transcode_store: tauri::State<'_, TranscodingStore>,
    id: String,
) -> Result<(), ()> {
    let id = uuid::Uuid::from_str(&id).unwrap();

    debug!("Pausing transcoding: {}", id);

    transcode_store.pause(&id).await;

    debug!("Paused transcoding: {}", id);
    Ok(())
}
