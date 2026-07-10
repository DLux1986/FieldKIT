export function generateSampleId(systemType, sampleNumber, testNumber) {
  const normalizedType = String(systemType || '').trim().toUpperCase();
  const normalizedSample = Number(sampleNumber);
  const normalizedTest = Number(testNumber);

  if (!normalizedType) {
    throw new Error('System type is required to generate a sample ID.');
  }

  if (!Number.isInteger(normalizedSample) || normalizedSample < 1) {
    throw new Error('Sample number must be a positive integer.');
  }

  if (!Number.isInteger(normalizedTest) || normalizedTest < 1) {
    throw new Error('Test number must be a positive integer.');
  }

  return `${normalizedType}-S${String(normalizedSample).padStart(2, '0')}T${String(normalizedTest).padStart(2, '0')}`;
}

export function parseSampleId(sampleId) {
  if (!sampleId || typeof sampleId !== 'string') {
    return { systemType: '', sampleNumber: 0, testNumber: 0 };
  }

  // Match format: "SLDR-S01T02" or "SLDR-S1T2"
  const match = sampleId.trim().match(/^([A-Z0-9]+)-S(\d{1,2})T(\d{1,2})$/i);
  if (match) {
    return {
      systemType: match[1].toUpperCase(),
      sampleNumber: Number(match[2]),
      testNumber: Number(match[3])
    };
  }

  return { systemType: '', sampleNumber: 0, testNumber: 0 };
}

export function formatSampleId(value) {
  if (!value && value !== 0) return "";

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const explicitMatch = trimmed.match(/^([A-Z0-9]+)-S(\d{1,2})T(\d{1,2})$/i);
    if (explicitMatch) {
      return `${explicitMatch[1].toUpperCase()}-S${String(Number(explicitMatch[2])).padStart(2, '0')}T${String(Number(explicitMatch[3])).padStart(2, '0')}`;
    }

    const numericMatch = trimmed.match(/^(\d+)$/);
    if (numericMatch) {
      return `S${String(Number(numericMatch[1])).padStart(2, '0')}`;
    }

    return trimmed;
  }

  if (typeof value === 'number') {
    return `S${String(value).padStart(2, '0')}`;
  }

  if (typeof value === 'object') {
    const systemType = String(value.systemType || value.window_type || value.system_type || '').trim().toUpperCase();
    const sampleNumber = Number(value.sampleNumber ?? value.sample_number ?? value.sample ?? 1);
    const testNumber = Number(value.testNumber ?? value.test_number ?? value.test ?? 1);

    if (systemType) {
      return generateSampleId(systemType, sampleNumber, testNumber);
    }
  }

  return String(value);
}
