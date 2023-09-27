use std::str::FromStr;

use serde_with::{serde_as, NoneAsEmptyString};

use crate::{
    app::config::Config,
    handlers::{error::Error, task::store::TaskStore},
    with_default_args,
};

/// A structure receiving ffmpeg command line arguments.
#[derive(Debug, serde::Deserialize)]
pub struct TranscodeItem {
    inputs: Vec<InputParams>,
    outputs: Vec<OutputParams>,
}

impl TranscodeItem {
    /// Converts to ffmpeg command line arguments.
    fn to_args(&self) -> Vec<String> {
        let prepend_args = with_default_args!("-progress", "-", "-nostats")
            .iter()
            .map(|str| *str);
        let input_args = self.inputs.iter().flat_map(|input| {
            input
                .params
                .iter()
                .map(|param| param.as_str())
                .chain(["-i", input.path.as_str()])
        });
        let output_args = self.outputs.iter().flat_map(|output| {
            output
                .params
                .iter()
                .map(|param| param.as_str())
                .chain([output.path.as_ref().map(|path| path.as_str()).unwrap_or("")])
        });
        let append_args = [("-y")];
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

#[serde_as]
#[derive(Debug, serde::Deserialize)]
pub struct OutputParams {
    /// Output path could be None in some situation,
    /// such as exports to null.
    #[serde_as(as = "NoneAsEmptyString")]
    path: Option<String>,
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
    transcode_store: tauri::State<'_, TaskStore>,
    item: TranscodeItem,
) -> Result<TranscodeId, Error> {
    // let id = transcode_store
    //     .add_and_start(
    //         app_handle,
    //         config.binary().ffmpeg().to_string(),
    //         item.to_args(),
    //     )
    //     .await?;

    // Ok(TranscodeId { id: id.to_string() })

    todo!()
}

/// A command stops a new transcode job.
#[tauri::command]
pub async fn stop_transcode(
    transcode_store: tauri::State<'_, TaskStore>,
    id: String,
) -> Result<(), Error> {
    let id = id.try_into_uuid()?;
    // transcode_store.stop(&id).await;
    Ok(())
}

/// A command pauses a new transcode job.
#[tauri::command]
pub async fn pause_transcode(
    transcode_store: tauri::State<'_, TaskStore>,
    id: String,
) -> Result<(), Error> {
    let id = id.try_into_uuid()?;
    // transcode_store.pause(&id).await;
    Ok(())
}

/// A command resumes a new transcode job.
#[tauri::command]
pub async fn resume_transcode(
    transcode_store: tauri::State<'_, TaskStore>,
    id: String,
) -> Result<(), Error> {
    let id = id.try_into_uuid()?;
    // transcode_store.resume(&id).await;
    Ok(())
}

trait TryIntoUuid {
    fn try_into_uuid(self) -> Result<uuid::Uuid, Error>;
}

impl<S> TryIntoUuid for S
where
    S: Into<String> + 'static,
{
    fn try_into_uuid(self) -> Result<uuid::Uuid, Error> {
        let raw = self.into();
        match uuid::Uuid::from_str(&raw) {
            Ok(uuid) => Ok(uuid),
            Err(_) => Err(Error::task_id_unavailable(raw)),
        }
    }
}
