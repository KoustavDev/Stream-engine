function extractPublicId(url) {
  // Split the URL by '/'
  const parts = url.split("/");

  // Find the index of the version segment, which starts with "v"
  const versionIndex = parts.findIndex((part) => part.startsWith("v"));

  // The public ID with extension is the segment right after the version
  const publicIdWithExtension = parts[versionIndex + 1];

  // Remove the file extension by finding the last dot and taking the substring before it
  const dotIndex = publicIdWithExtension.lastIndexOf(".");
  return publicIdWithExtension.substring(0, dotIndex);
}

export default extractPublicId;