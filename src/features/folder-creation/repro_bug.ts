
// Minimal reproduction of generatePreview logic
interface FolderConfig {
    subfolders: string;
    subfolderPrefix: string;
    subfolderSuffix: string;
    count: number;
    creationMode: 'pattern' | 'list' | 'csv';
    rootPath: string;
    baseName: string; // The "Base Name" (renamed from prefix to match file tab)

    // Numbering
    useNumbering: boolean;
    startNumber: number;
    digitCount: number; // 1, 2, 3, 4 (padding)
    numberPosition: 'prefix' | 'suffix' | 'after-prefix' | 'before-suffix';

    // Formatting
    separator: string; // "-", "_", ".", " ", or "" (NONE)

    // Custom prefix and suffix
    customPrefix: string;
    customSuffix: string;

    // Date/Time
    useDate: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD' | 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD_HH-MM-SS' | 'YYYYMMDD_HHMMSS' | 'timestamp';
    datePosition: 'prefix' | 'suffix';

    // Random string generation
    useRandomString: boolean;
    randomStringLength: number;
    randomStringPosition: 'prefix' | 'suffix';

    // UUID generation
    useUUID: boolean;
    uuidPosition: 'prefix' | 'suffix';

    // Overwrite option
    overwrite?: boolean;

    // Creation Mode
    folderList: string;

    // CSV Configuration
    csvDelimiter: string; // The configured delimiter for combining columns
    csvColumnOrder: string[]; // IDs of columns in order
    csvColumnConfig: Record<string, {
        enabled: boolean;
        prefix: string;
        suffix: string;
    }>;
    csvRows: Record<string, string>[]; // Parsed CSV data (for preview/generation)
    csvHeaders: string[]; // Original headers or generated Column_X
}

interface PreviewNode {
    id: string;
    name: string;
    children?: PreviewNode[];
}

const generateFolderName = (
    index: number,
    config: FolderConfig,
): string => {
    return `${config.baseName}_${index}`;
};


const generatePreview = (config: FolderConfig): PreviewNode[] => {
    const nodes: PreviewNode[] = [];
    const subfolderNames = config.subfolders
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    console.log("Subfolder names parsed:", subfolderNames);

    if (config.creationMode === 'pattern') {
        const previewCount = Math.min(config.count, 50);

        for (let i = 1; i <= previewCount; i++) {
            const folderName = generateFolderName(i, config);
            const parentId = `folder-${i}`;

            const children: PreviewNode[] = subfolderNames.map((sub, subIndex) => ({
                id: `${parentId}-sub-${subIndex}`,
                name: `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`,
            }));

            nodes.push({
                id: parentId,
                name: folderName,
                children,
            });
        }
    }
    return nodes;
};

// Test
const config: FolderConfig = {
    subfolders: "Docs, Images",
    subfolderPrefix: "",
    subfolderSuffix: "",
    count: 2,
    creationMode: 'pattern',
    rootPath: "/tmp",
    baseName: "Test",
    useNumbering: true,
    startNumber: 1,
    digitCount: 2,
    numberPosition: 'prefix',
    separator: "_",
    customPrefix: "",
    customSuffix: "",
    useDate: false,
    dateFormat: 'YYYY-MM-DD',
    datePosition: 'prefix',
    useRandomString: false,
    randomStringLength: 8,
    randomStringPosition: 'suffix',
    useUUID: false,
    uuidPosition: 'suffix',
    folderList: "",
    csvDelimiter: ",",
    csvColumnOrder: [],
    csvColumnConfig: {},
    csvRows: [],
    csvHeaders: []
};

const nodes = generatePreview(config);
console.log("Nodes generated:", JSON.stringify(nodes, null, 2));

if (nodes[0].children && nodes[0].children.length === 2) {
    console.log("SUCCESS: Children generated");
} else {
    console.log("FAILURE: Children NOT generated");
}
