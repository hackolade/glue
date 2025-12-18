const fs = require('fs');
const path = require('path');

const forwardEngineeringDir = path.join(__dirname, 'forward_engineering');
const gluePluginDir = __dirname;

// Get all JS/TS files in forward_engineering
function getAllFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);
	files.forEach(file => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			getAllFiles(filePath, fileList);
		} else if (/\.(js|ts|jsx|tsx)$/.test(file)) {
			fileList.push(filePath);
		}
	});
	return fileList;
}

const forwardEngineeringFiles = getAllFiles(forwardEngineeringDir);
const allGlueFiles = getAllFiles(gluePluginDir);

// Get all file content for searching
const glueFileContents = allGlueFiles.map(filePath => ({
	path: filePath,
	content: fs.readFileSync(filePath, 'utf8'),
}));

// Check if a file is imported
function isFileImported(targetFile) {
	const relativePath = path.relative(gluePluginDir, targetFile);
	const fileName = path.basename(targetFile, path.extname(targetFile));
	const dirName = path.dirname(relativePath);

	// Various import patterns to check
	const patterns = [
		// require patterns
		new RegExp(`require\\(['"]\\.\\.?/[^'"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'i'),
		new RegExp(`require\\(['"][^'"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'i'),
		// import patterns
		new RegExp(
			`import\\s+.*\\s+from\\s+['"]\\.\\.?/[^'"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
			'i',
		),
		new RegExp(`import\\s+.*\\s+from\\s+['"][^'"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'i'),
		// dynamic import
		new RegExp(`import\\(['"][^'"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'i'),
		// Full relative path patterns
		new RegExp(relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
		// Path without extension
		new RegExp(relativePath.replace(/\.(js|ts|jsx|tsx)$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
	];

	// Also check for the file path relative to forward_engineering
	const feRelativePath = path.relative(path.join(gluePluginDir, 'forward_engineering'), targetFile);
	patterns.push(
		new RegExp(feRelativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
		new RegExp(feRelativePath.replace(/\.(js|ts|jsx|tsx)$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
	);

	for (const fileData of glueFileContents) {
		// Skip the file itself
		if (fileData.path === targetFile) {
			continue;
		}

		for (const pattern of patterns) {
			if (pattern.test(fileData.content)) {
				return true;
			}
		}
	}

	return false;
}

// Check each file
const unimportedFiles = [];
for (const file of forwardEngineeringFiles) {
	if (!isFileImported(file)) {
		unimportedFiles.push(path.relative(gluePluginDir, file));
	}
}

console.log('Files in forward_engineering that are not imported:');
console.log('='.repeat(60));
if (unimportedFiles.length === 0) {
	console.log('All files are imported!');
} else {
	unimportedFiles.sort().forEach(file => console.log(file));
	console.log(`\nTotal: ${unimportedFiles.length} unimported file(s)`);
}
