use std::{collections::VecDeque, fs, path::PathBuf};

use crate::handlers::error::Error;

#[derive(Debug, serde::Serialize)]
#[serde(tag = "type")]
pub enum SearchEntry {
    Directory {
        name: String,
        /// Canonicalize path.
        /// On Windows os, extended length path is used.
        absolute: String,
        relative: String,
        children: Vec<SearchEntry>,
        #[serde(skip_serializing)]
        path: PathBuf,
    },
    File {
        name: String,
        /// File extension, lowercased.
        extension: Option<String>,
        /// Canonicalize path.
        /// On Windows os, extended length path is used.
        absolute: String,
        relative: String,
    },
}

impl SearchEntry {
    fn from_path(path: PathBuf, relative_prefix_len: usize) -> Option<Self> {
        let (Some(name), extension, Ok(absolute)) = (
            path.file_name().map(|s| s.to_string_lossy().to_string()),
            path.extension()
                .map(|s| s.to_string_lossy().to_lowercase().to_string()),
            path.canonicalize().map(|s| s.to_string_lossy().to_string()),
        ) else {
            return None;
        };

        let relative = absolute[relative_prefix_len..].to_string();

        if path.is_dir() {
            Some(SearchEntry::Directory {
                name,
                absolute,
                relative,
                children: Vec::with_capacity(12),
                path,
            })
        } else if path.is_file() {
            Some(SearchEntry::File {
                name,
                extension,
                absolute,
                relative,
            })
        } else {
            None
        }
    }

    fn is_dir(&self) -> bool {
        match self {
            SearchEntry::Directory { .. } => true,
            SearchEntry::File { .. } => false,
        }
    }
}

/// A command finds all files(in relative path) from a directory recursively
/// and returns a flatten files list will be returned.
///
/// `mex_depth` tells how depth should recursively search in, default for `5`.
/// For performance considering, always provides a small value.
#[tauri::command]
pub async fn files_from_directory(
    dir: String,
    max_depth: Option<usize>,
) -> Result<SearchEntry, Error> {
    let max_depth = max_depth.unwrap_or(5);

    let path = PathBuf::from(&dir);
    if !path.is_dir() {
        return Err(Error::directory_not_found(dir));
    }

    let Ok(canonicalized_path) = path.canonicalize().map(|p| p.to_string_lossy().to_string())
    else {
        return Err(Error::directory_not_found(dir));
    };
    let relative_prefix_len = canonicalized_path.as_bytes().len();

    let Some(mut startup) = SearchEntry::from_path(path, relative_prefix_len).map(|e| (e)) else {
        return Err(Error::directory_not_found(dir));
    };

    let startup_ptr: *mut SearchEntry = &mut startup;
    let mut directories = VecDeque::from([(startup_ptr, 0)]);
    while let Some((current_dir_ptr, depth)) = directories.pop_front() {
        let current_dir = unsafe { &mut *current_dir_ptr };

        let SearchEntry::Directory { children, path, .. } = current_dir else {
            continue;
        };

        let Ok(mut entries) = fs::read_dir(path) else {
            continue;
        };

        while let Some(next_entry) = entries
            .next()
            .and_then(|e| e.ok())
            .and_then(|e| SearchEntry::from_path(e.path(), relative_prefix_len))
        {
            children.push(next_entry);
        }

        let next_depth = depth + 1;
        if next_depth <= max_depth {
            children.iter_mut().for_each(|child| {
                if child.is_dir() {
                    let child_ptr: *mut SearchEntry = child;
                    directories.push_back((child_ptr, next_depth));
                }
            })
        }
    }

    Ok(startup)
}
