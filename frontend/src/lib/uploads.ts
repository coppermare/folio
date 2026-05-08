export const SUPPORTED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".md"] as const;

export const SUPPORTED_UPLOAD_ACCEPT = SUPPORTED_UPLOAD_EXTENSIONS.join(",");

export const UNSUPPORTED_FILE_WARNING =
	"Only PDF, DOCX, and Markdown files are supported.";

export function isSupportedUploadFile(filename: string): boolean {
	const lower = filename.toLowerCase();
	return SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
