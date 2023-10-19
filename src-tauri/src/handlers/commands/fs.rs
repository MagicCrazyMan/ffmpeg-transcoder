use std::{
    collections::VecDeque,
    fs,
    path::{PathBuf, MAIN_SEPARATOR},
};

use smallvec::SmallVec;

use crate::handlers::error::Error;

#[derive(serde::Serialize)]
#[serde(tag = "type")]
pub enum SearchEntry {
    Directory {
        /// Canonicalize path.
        /// On Windows os, extended length path is used.
        absolute: String,
        relative_components: SmallVec<[String; 5]>,
        name: String,
        children: Vec<SearchEntry>,
        #[serde(skip_serializing)]
        path: PathBuf,
    },
    File {
        /// Canonicalize path.
        /// On Windows os, extended length path is used.
        absolute: String,
        relative_components: SmallVec<[String; 5]>,
        name: String,
        stem: Option<String>,
        /// File extension, lowercased.
        extension: Option<String>,
    },
}

impl SearchEntry {
    fn from_path(path: PathBuf, search_dir: &str) -> Option<Self> {
        let (Some(name), Ok(absolute)) = (
            path.file_name().map(|s| s.to_string_lossy().to_string()),
            path.canonicalize().map(|s| s.to_string_lossy().to_string()),
        ) else {
            return None;
        };

        let relative_slice = if search_dir == absolute {
            0..absolute.as_bytes().len()
        } else {
            search_dir.as_bytes().len()..(absolute.as_bytes().len() - name.as_bytes().len())
        };

        let relative_components = absolute[relative_slice]
            .split(MAIN_SEPARATOR)
            .filter(|p| !p.is_empty())
            .map(|p| p.to_string())
            .collect::<SmallVec<_>>();

        if path.is_dir() {
            Some(SearchEntry::Directory {
                absolute,
                relative_components,
                name,
                children: Vec::with_capacity(12),
                path,
            })
        } else if path.is_file() {
            Some(SearchEntry::File {
                absolute,
                relative_components,
                name,
                stem: path.file_stem().map(|s| s.to_string_lossy().to_string()),
                extension: path
                    .extension()
                    .map(|s| s.to_string_lossy().to_lowercase().to_string()),
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

#[derive(serde::Serialize)]
pub struct Search {
    search_dir: String,
    search_dir_components: SmallVec<[String; 5]>,
    entry: SearchEntry,
}

/// A command finds all files(in relative path) from a directory recursively
/// and returns a flatten files list will be returned.
///
/// `mex_depth` tells how depth should recursively search in, default for `5`.
/// For performance considering, always provides a small value.
#[tauri::command]
pub async fn search_directory(dir: String, max_depth: Option<usize>) -> Result<Search, Error> {
    let max_depth = max_depth.unwrap_or(5);

    let search_dir = PathBuf::from(&dir);
    if !search_dir.is_dir() {
        return Err(Error::directory_not_found(dir));
    }

    let Ok(search_dir_absolute) = search_dir
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
    else {
        return Err(Error::directory_not_found(dir));
    };

    let search_dir_components = {
        #[cfg(windows)]
        {
            // removes extends limitation path prefix for windows
            ["\\\\?"]
                .into_iter()
                .chain(
                    search_dir_absolute[4..]
                        .split(MAIN_SEPARATOR)
                        .into_iter()
                        .filter(|p| !p.is_empty()),
                )
                .map(|p| p.to_string())
                .collect::<SmallVec<_>>()
        }

        #[cfg(not(windows))]
        {
            search_dir_absolute
                .split(MAIN_SEPARATOR)
                .filter(|p| !p.is_empty())
                .map(|p| p.to_string())
                .collect::<SmallVec<_>>()
        }
    };

    let Some(mut root) = SearchEntry::from_path(search_dir, &search_dir_absolute).map(|e| (e))
    else {
        return Err(Error::directory_not_found(dir));
    };

    let root_ptr: *mut SearchEntry = &mut root;
    let mut directories = VecDeque::from([(root_ptr, 0)]);
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
            .and_then(|e| SearchEntry::from_path(e.path(), &search_dir_absolute))
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

    Ok(Search {
        entry: root,
        search_dir: search_dir_absolute,
        search_dir_components,
    })
}
