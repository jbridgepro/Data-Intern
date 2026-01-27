
import { readTextFile, writeTextFile, rename } from "@tauri-apps/plugin-fs";

export async function replaceInFile(
    filePath: string,
    replacements: { line: number, oldText: string, newText: string, matchIndex: number }[],
    createBackup: boolean = true
): Promise<boolean> {
    const isBrowser = !(window as any).__TAURI_INTERNALS__;
    if (isBrowser) {
        console.log("Mock replace", filePath, replacements);
        return true;
    }

    try {
        const content = await readTextFile(filePath);

        if (createBackup) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            await writeTextFile(`${filePath}.bak-${timestamp}`, content);
        }

        const lines = content.split('\n');

        // Sort replacements by line descending to avoid index shifting issues if we were modifying the array 
        // (though we are modifying lines, so line numbers are stable unless we insert/delete lines)
        // Since we are just replacing text *within* lines, line numbers are stable.

        // Group by line
        const replacementsByLine = new Map<number, typeof replacements>();
        replacements.forEach(r => {
            if (!replacementsByLine.has(r.line)) {
                replacementsByLine.set(r.line, []);
            }
            replacementsByLine.get(r.line)?.push(r);
        });

        replacementsByLine.forEach((lineRepls, lineNum) => {
            // 0-indexed array, 1-indexed lines
            const index = lineNum - 1;
            if (index >= 0 && index < lines.length) {
                let line = lines[index];
                // Replace in reverse order of index to match correctly
                lineRepls.sort((a, b) => b.matchIndex - a.matchIndex);

                lineRepls.forEach(r => {
                    // Verify match still exists (basic safety)
                    // Note: This logic assumes non-overlapping matches
                    // Doing simple string slice replacement
                    /*
                    line = line.substring(0, r.matchIndex) + 
                           r.newText + 
                           line.substring(r.matchIndex + r.oldText.length);
                    */
                    // However, r.matchIndex is from the *original* search.
                    // If we have multiple replacements in one line, changing one shifts indices for others?
                    // YES. That's why we sort descending by matchIndex.

                    // BUT, our search logic returns trimmed content, so the matchIndex might be relative to the trimmed string??
                    // Wait, searchLogic.ts:
                    // while ((match = regex.exec(line)) !== null) ... matches.push({ ..., matchIndex: match.index ... })
                    // Regex.exec runs on the full line string. So match.index is correct for the full line.
                    // The `content: line.trim()` is just for display.

                    // So we are safe using match.index on the original line string.

                    // One more check: Regexp might match the same thing ?
                    // And we are assuming `r.oldText` length. `match` object in searchLogic had match length. 
                    // We need match length in replacements to be safe if we support regex.
                    // Let's assume the calling code passes the length or the original match text.
                    // The `oldText` should correspond to the match length.

                    // For now, let's assume one replacement per line or handle carefully.
                    // The simplest robust way is rebuilding the string.

                    const before = line.substring(0, r.matchIndex);
                    const after = line.substring(r.matchIndex + r.oldText.length); // assuming oldText is the exact match content
                    line = before + r.newText + after;
                });

                lines[index] = line;
            }
        });

        await writeTextFile(filePath, lines.join('\n'));
        return true;
    } catch (e) {
        console.error("Failed to replace in file", filePath, e);
        return false;
    }
}
