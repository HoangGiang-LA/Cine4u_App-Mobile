import {WireQuestion} from "./attemptHelper";

type RecordData = Record<string, unknown>;
export interface ContentRelations {
  categories: RecordData;
  topics: RecordData;
  lessons: RecordData;
  assets: RecordData;
}

/**
 * Convert untrusted database data into a record, excluding arrays.
 * @param {unknown} value Stored value.
 * @return {object} Record, or an empty object for invalid values.
 */
export function record(value: unknown): RecordData {
  return value && typeof value === "object" && !Array.isArray(value) ?
    value as RecordData : {};
}

/**
 * IDs used in database paths must be single, non-empty Firebase keys.
 * @param {unknown} value Candidate key.
 * @return {boolean} Whether the key is safe for a single path segment.
 */
export function contentId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    Buffer.byteLength(value, "utf8") <= 768 &&
    !/[.#$[\]/]/u.test(value) &&
    [...value].every((char) => char.charCodeAt(0) >= 32 &&
      char.charCodeAt(0) !== 127);
}

/**
 * A topic is playable only under one of the four published skills.
 * @param {unknown} topicId Topic key.
 * @param {ContentRelations} relations Current content metadata.
 * @return {boolean} Whether the topic and its skill are published.
 */
export function publishedTopic(
  topicId: unknown,
  relations: ContentRelations,
): boolean {
  if (!contentId(topicId)) return false;
  const topic = record(relations.topics[topicId]);
  const categoryId = topic.categoryId;
  return typeof categoryId === "string" &&
    ["vocabulary", "grammar", "listening", "reading"].includes(categoryId) &&
    topic.status === "published" &&
    record(relations.categories[categoryId]).status === "published";
}

/**
 * Validate the parent chain and expose only playable question fields.
 * @param {string} id Question key.
 * @param {unknown} metadata Question metadata.
 * @param {unknown} version Immutable question version.
 * @param {unknown} answer Trusted answer for this version.
 * @param {ContentRelations} relations Current parent metadata and TTS assets.
 * @return {WireQuestion|null} Safe question, or null when invalid.
 */
export function playableQuestion(
  id: string,
  metadata: unknown,
  version: unknown,
  answer: unknown,
  relations: ContentRelations,
): WireQuestion | null {
  const meta = record(metadata);
  if (!contentId(id) || meta.status !== "published" ||
      !contentId(meta.currentVersion) || !contentId(meta.topicId) ||
      !contentId(meta.lessonId) || !publishedTopic(meta.topicId, relations)) {
    return null;
  }
  const topic = record(relations.topics[meta.topicId]);
  const lesson = record(relations.lessons[meta.lessonId]);
  if (meta.categoryId !== topic.categoryId ||
      lesson.status !== "published" || lesson.topicId !== meta.topicId ||
      lesson.categoryId !== meta.categoryId) return null;
  const expectedType = meta.categoryId === "reading" ?
    "reading_single_choice" : meta.categoryId === "listening" ?
      "listening_single_choice" : "single_choice";
  if (meta.type !== expectedType) return null;

  const content = record(version);
  const trustedAnswer = record(answer);
  if (content.version !== meta.currentVersion ||
      content.questionTimeLimitSeconds !== 30 ||
      typeof content.prompt !== "string" || !content.prompt.trim() ||
      typeof trustedAnswer.explanation !== "string" ||
      !trustedAnswer.explanation.trim()) return null;

  const options = Object.entries(record(content.options));
  if (options.length !== 4) return null;
  const texts = new Set<string>();
  const orders = new Set<number>();
  const wireOptions = [];
  for (const [optionId, value] of options) {
    const option = record(value);
    if (!contentId(optionId) || typeof option.text !== "string" ||
        !option.text.trim() || typeof option.order !== "number" ||
        !Number.isInteger(option.order) ||
        option.order < 1 || option.order > 4 ||
        texts.has(option.text.trim()) ||
        orders.has(option.order)) return null;
    texts.add(option.text.trim());
    orders.add(option.order);
    wireOptions.push({id: optionId, text: option.text, order: option.order});
  }
  if (!wireOptions.some(
    (option) => option.id === trustedAnswer.correctOptionId,
  )) {
    return null;
  }

  const passage = typeof content.passage === "string" ? content.passage : "";
  let audioText = typeof content.audioText === "string" ?
    content.audioText : "";
  if (meta.categoryId === "reading" && !passage.trim()) return null;
  if (meta.categoryId === "listening") {
    if (content.audioAssetId !== undefined) {
      if (!contentId(content.audioAssetId)) return null;
      const asset = record(relations.assets[content.audioAssetId]);
      if (asset.status !== "published" || asset.kind !== "tts" ||
          typeof asset.speechText !== "string") return null;
      audioText = asset.speechText;
    }
    if (!audioText.trim()) return null;
  }
  return {
    id,
    version: meta.currentVersion,
    categoryId: meta.categoryId as string,
    topicId: meta.topicId,
    prompt: content.prompt,
    options: wireOptions.sort((a, b) => a.order - b.order)
      .map(({id: optionId, text}) => ({id: optionId, text})),
    passage,
    audioText,
  };
}
