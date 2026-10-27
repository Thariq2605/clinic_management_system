export function buildResourcePayload(fields, values, mode) {
  const payload = { ...values };
  fields.forEach((field) => {
    if (field.type === 'number' && payload[field.name] !== '') payload[field.name] = Number(payload[field.name]);
    if (field.omitOnEdit && mode === 'edit') delete payload[field.name];
    if (field.omitEmpty && (payload[field.name] === '' || payload[field.name] == null)) delete payload[field.name];
  });
  return payload;
}
