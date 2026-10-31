export function imageFields(record = {}) {
  return { imageUrl: record.imageUrl || record.image || '', imagePublicId: record.imagePublicId || '', imageVersion: record.imageVersion || null };
}

export function imageResponse(record) {
  if (!record) return record;
  const fields = imageFields(record);
  return { ...record, ...fields, image: fields.imageUrl };
}

export function offerImageInput(data, product, previous = {}) {
  const url = data.imageUrl ?? data.image ?? imageFields(previous).imageUrl;
  if (!data.imageUploadToken && !data.imagePublicId && !previous.imagePublicId && url && url === imageFields(product || {}).imageUrl) {
    return { ...data, image: '', imageUrl: '', imagePublicId: '', imageVersion: null };
  }
  return data;
}
