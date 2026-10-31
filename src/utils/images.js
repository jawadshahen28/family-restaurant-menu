export function imagePayload(url, uploaded) {
  if (!uploaded || uploaded.imageUrl !== url) return { image: url || '' };
  return { image: url, imageUrl: url, imagePublicId: uploaded.imagePublicId, imageVersion: uploaded.imageVersion, imageUploadToken: uploaded.imageUploadToken };
}
