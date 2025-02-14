function extractPublicId(url) {
  // Split the URL by '/'
  const parts = url.split("/");

  // Find the index of the version segment (contains "v" followed by numbers)
  const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));

  if (versionIndex !== -1 && versionIndex < parts.length - 1) {
    // The public ID with extension is the segment right after the version
    const publicIdWithExtension = parts[versionIndex + 1];

    // Remove the file extension by finding the last dot and taking the substring before it
    const dotIndex = publicIdWithExtension.lastIndexOf(".");
    if (dotIndex !== -1) {
      return publicIdWithExtension.substring(0, dotIndex);
    }
    return publicIdWithExtension;
  }

  return null; // Return null if the pattern doesn't match
}

export default extractPublicId;