use tauri::{AppHandle, Emitter};
use serde::{Serialize, Deserialize};
use ignore::WalkBuilder;
use regex::RegexBuilder;
use std::fs;
use std::path::Path;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    pub match_case: bool,
    pub use_regex: bool,
    pub whole_word: bool,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
    pub target: Option<String>, // "content", "filename", "folder", "all"
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub line: usize,
    pub content: String,
    pub match_index: usize,
    pub length: usize,
    // UTF-16 fields for correct highlighting in JS strings
    pub match_index_utf16: usize,
    pub length_utf16: usize,
    // Source type: "content", "filename", or "folder"
    pub source: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileResult {
    pub path: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchProgress {
    scanned: usize,
    found: usize,
}

#[derive(Debug, Deserialize)]
pub struct FileReplacement {
    pub path: String,
    pub replacements: Vec<ReplacementItem>,
}

#[derive(Debug, Deserialize)]
pub struct ReplacementItem {
    pub line: usize, // 1-based line number
    pub match_index: usize, // byte index from search
    pub old_text: String, // mostly for verification
    pub new_text: String,
}

#[tauri::command]
pub async fn search_filesystem(
    app: AppHandle,
    root_path: String,
    query: String,
    options: SearchOptions,
    search_id: String, // Unique ID to allow cancellation/events
) -> Result<(), String> {
    let search_id_clone = search_id.clone();
    
    // Run blocking search in a separate thread to avoid blocking the async runtime
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(e) = run_search(app, root_path, query, options, search_id_clone) {
            eprintln!("Search failed: {}", e);
        }
    });

    Ok(())
}

fn run_search(
    app: AppHandle,
    root_path: String,
    query: String,
    options: SearchOptions,
    search_id: String,
) -> Result<(), String> {
    let target = options.target.as_deref().unwrap_or("content");
    
    // Prepare Regex
    let pattern = if options.use_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };
    
    let final_pattern = if options.whole_word {
        format!(r"\b{}\b", pattern)
    } else {
        pattern
    };

    let re = RegexBuilder::new(&final_pattern)
        .case_insensitive(!options.match_case)
        .build()
        .map_err(|e| format!("Invalid regex: {}", e))?;

    // Prepare Walker (respects .gitignore by default)
    let mut builder = WalkBuilder::new(&root_path);
    builder.hidden(false); 
    builder.git_ignore(true);
    
    if let Some(exclude) = &options.exclude_pattern {
        if !exclude.is_empty() {
             let mut overrides = ignore::overrides::OverrideBuilder::new(&root_path);
             for pat in exclude.split(',') {
                 let pat = pat.trim();
                 if !pat.is_empty() {
                    let _ = overrides.add(&format!("!{}", pat)); // ! excludes
                 }
             }
             if let Ok(ov) = overrides.build() {
                 builder.overrides(ov);
             }
        }
    }
    
    if let Some(include) = &options.include_pattern {
        if !include.is_empty() {
             let mut overrides = ignore::overrides::OverrideBuilder::new(&root_path);
             for pat in include.split(',') {
                 let pat = pat.trim();
                 if !pat.is_empty() {
                    let _ = overrides.add(pat); 
                 }
             }
             if let Ok(ov) = overrides.build() {
                 builder.overrides(ov);
             }
        }
    }

    let walker = builder.build();
    
    let mut scanned_count = 0;
    let mut match_count = 0;
    let batch_size = 50; // Emit results in batches
    let mut batch = Vec::new();

    for result in walker {
        match result {
            Ok(entry) => {
                let is_file = entry.file_type().map(|ft| ft.is_file()).unwrap_or(false);
                let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);

                let path = entry.path();
                let path_str = path.to_string_lossy().to_string();

                // ── Handle directory entries: search folder names ──
                if is_dir {
                    if target == "folder" || target == "all" {
                        // Skip the root path itself to avoid a self-match
                        if path_str != root_path {
                            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                                let mut dir_matches = Vec::new();
                                for mat in re.find_iter(name) {
                                    let pre_match = &name[..mat.start()];
                                    let match_str = &name[mat.start()..mat.end()];

                                    dir_matches.push(SearchMatch {
                                        line: 0,
                                        content: name.to_string(),
                                        match_index: mat.start(),
                                        length: mat.end() - mat.start(),
                                        match_index_utf16: pre_match.encode_utf16().count(),
                                        length_utf16: match_str.encode_utf16().count(),
                                        source: "folder".to_string(),
                                    });
                                }
                                if !dir_matches.is_empty() {
                                    match_count += dir_matches.len();
                                    batch.push(FileResult {
                                        path: path_str.clone(),
                                        matches: dir_matches,
                                    });
                                }
                            }
                        }
                    }
                    // Continue to let the walker descend into subdirectories
                    continue;
                }

                // Skip non-file, non-directory entries (e.g. symlinks)
                if !is_file {
                    continue;
                }

                // ── Handle file entries ──
                let mut file_matches = Vec::new();

                // Filename Search
                if target == "filename" || target == "all" {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                         if re.is_match(name) {
                             for mat in re.find_iter(name) {
                                  let pre_match = &name[..mat.start()];
                                  let match_str = &name[mat.start()..mat.end()];

                                  file_matches.push(SearchMatch {
                                      line: 0,
                                      content: name.to_string(),
                                      match_index: mat.start(),
                                      length: mat.end() - mat.start(),
                                      match_index_utf16: pre_match.encode_utf16().count(),
                                      length_utf16: match_str.encode_utf16().count(),
                                      source: "filename".to_string(),
                                  });
                             }
                         }
                    }
                }

                // Content Search
                if target == "content" || target == "all" {
                    if let Ok(content) = fs::read_to_string(path) {
                        for (i, line) in content.lines().enumerate() {
                            if re.is_match(line) {
                                for mat in re.find_iter(line) {
                                     let pre_match = &line[..mat.start()];
                                     let match_str = &line[mat.start()..mat.end()];

                                     file_matches.push(SearchMatch {
                                         line: i + 1,
                                         content: line.to_string(),
                                         match_index: mat.start(),
                                         length: mat.end() - mat.start(),
                                         match_index_utf16: pre_match.encode_utf16().count(),
                                         length_utf16: match_str.encode_utf16().count(),
                                         source: "content".to_string(),
                                     });
                                }
                            }
                        }
                    }
                }

                if !file_matches.is_empty() {
                    match_count += file_matches.len();
                    batch.push(FileResult {
                        path: path_str,
                        matches: file_matches,
                    });
                }

                scanned_count += 1;

                // Emit batch when it reaches the threshold
                if batch.len() >= batch_size {
                    let _ = app.emit(&format!("search-results-{}", search_id), &batch);
                    batch.clear();

                     let _ = app.emit(&format!("search-progress-{}", search_id), SearchProgress {
                        scanned: scanned_count,
                        found: match_count,
                    });
                }

                // Throttle progress updates
                if scanned_count % 100 == 0 {
                    let _ = app.emit(&format!("search-progress-{}", search_id), SearchProgress {
                        scanned: scanned_count,
                        found: match_count,
                    });
                }
            }
            Err(err) => eprintln!("Error traversing: {}", err),
        }
    }

    // Emit remaining
    if !batch.is_empty() {
        let _ = app.emit(&format!("search-results-{}", search_id), &batch);
    }
    
    // Final progress
     let _ = app.emit(&format!("search-progress-{}", search_id), SearchProgress {
        scanned: scanned_count,
        found: match_count,
    });
    
    // Done event
    let _ = app.emit(&format!("search-done-{}", search_id), ());

    Ok(())
}

#[tauri::command]
pub async fn replace_in_files(
    files: Vec<FileReplacement>,
    create_backup: bool
) -> Result<usize, String> {
    let mut success_count = 0;

    for file_req in files {
        let path = Path::new(&file_req.path);
        
        if !path.exists() {
            eprintln!("File not found: {}", file_req.path);
            continue;
        }

        match fs::read_to_string(path) {
            Ok(content) => {
                // Create backup if requested
                if create_backup {
                    let backup_path = format!("{}.bak", file_req.path);
                    let _ = fs::write(&backup_path, &content);
                }

                // Group replacements by line for easier processing
                let mut replacements_by_line: HashMap<usize, Vec<&ReplacementItem>> = HashMap::new();
                for r in &file_req.replacements {
                    replacements_by_line.entry(r.line).or_default().push(r);
                }

                let mut new_lines = Vec::new();
                for (i, line) in content.lines().enumerate() {
                    let line_num = i + 1;
                    if let Some(repls) = replacements_by_line.get(&line_num) {
                        // Apply replacements for this line
                        // Sort by match_index descending to avoid offset issues
                        let mut sorted_repls = repls.clone();
                        sorted_repls.sort_by(|a, b| b.match_index.cmp(&a.match_index));

                        let mut new_line = line.to_string();
                        
                        for r in sorted_repls {
                            // Verify validity
                            if r.match_index < new_line.len() {
                                // We are using byte indices from Rust search, so strict slicing is okay IF valid UTF-8 boundary
                                // Rust strings are UTF-8. 
                                // r.match_index is a byte index.
                                // We can use split_at, but we need to remove 'old_text' length.
                                // NOTE: Rust search 'length' was byte length.
                                // We don't have 'length' in ReplacementItem, but we have old_text.
                                // Let's trust old_text length.
                                
                                let start = r.match_index;
                                let end = start + r.old_text.len();
                                
                                if end <= new_line.len() && &new_line[start..end] == r.old_text {
                                    new_line.replace_range(start..end, &r.new_text);
                                } else {
                                    eprintln!("Replacement mismatch in {}:{} - expected '{}' at {}, found '{}'", 
                                        file_req.path, line_num, r.old_text, start, 
                                        if end <= new_line.len() { &new_line[start..end] } else { "OOB" }
                                    );
                                }
                            }
                        }
                        new_lines.push(new_line);
                    } else {
                        new_lines.push(line.to_string());
                    }
                }

                // Write back
                // Join with original line endings ideally, but here using \n is standard
                let new_content = new_lines.join("\n"); 
                if let Err(e) = fs::write(path, new_content) {
                     eprintln!("Failed to write {}: {}", file_req.path, e);
                     continue;
                }
                
                success_count += 1;
            },
            Err(e) => {
                eprintln!("Failed to read {}: {}", file_req.path, e);
            }
        }
    }

    Ok(success_count)
}
